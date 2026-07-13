import { NextRequest, NextResponse } from "next/server";
import {
  discoverMovies,
  getMovieGenres,
  MOVIE_SORT_OPTIONS,
  TMDBError,
  type MovieSortBy,
} from "@/lib/tmdb";
import { enrichMoviesWithRatings, passesRatingFilters } from "@/lib/ratings";
import {
  interpretMoodQuery,
  isMoodSearchAvailable,
  resolveMoodFilters,
  discoverAndRankMoodPool,
  applyMoodFilterOverrides,
  toResolvedMoodParams,
  fromResolvedMoodParams,
  MoodSearchError,
  POOL_MIN_VOTE_COUNT,
  type ResolvedMoodParams,
} from "@/lib/mood-search";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isWatchRegion } from "@/lib/watch-providers";

const MAX_QUERY_LENGTH = 300;
// This route spends Anthropic credits per call - generous for a human
// typing queries, tight enough to blunt a script hammering it. Only
// enforced on the fresh-query (LLM) path below - re-running discovery
// against an already-resolved interpretation (a filter changing while a
// mood search is active) never touches Anthropic, so it doesn't count
// against this budget.
const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

function isResolvedMoodParams(value: unknown): value is ResolvedMoodParams {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { genres?: unknown; keywords?: unknown; sortBy?: unknown };
  return (
    Array.isArray(candidate.genres) &&
    Array.isArray(candidate.keywords) &&
    typeof candidate.sortBy === "string"
  );
}

export async function GET() {
  return NextResponse.json({ available: isMoodSearchAvailable() });
}

export async function POST(request: NextRequest) {
  if (!isMoodSearchAvailable()) {
    return NextResponse.json({ error: "Mood search is not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const {
    query,
    cachedInterpretation,
    genreIds: genreIdsOverride,
    sortBy: sortByOverride,
    minImdb: minImdbRaw,
    minRt: minRtRaw,
    watchProviderIds,
    watchRegion,
    page: pageRaw,
  } = (body ?? {}) as Record<string, unknown>;

  // Which tier of the already-ranked pool to return - Load More on the
  // client sends page 2+ alongside cachedInterpretation, never a fresh
  // query, so this never affects rate limiting or the LLM call below.
  let resultsPage = 1;
  if (pageRaw !== undefined) {
    resultsPage = Number(pageRaw);
    if (!Number.isInteger(resultsPage) || resultsPage < 1) {
      return NextResponse.json(
        { error: "Field 'page' must be a positive integer" },
        { status: 400 }
      );
    }
  }

  // Filter-override validation - all optional, all shared between the
  // fresh-query and cached-interpretation paths below.
  if (genreIdsOverride !== undefined) {
    if (
      !Array.isArray(genreIdsOverride) ||
      !genreIdsOverride.every((id) => Number.isInteger(id) && id > 0)
    ) {
      return NextResponse.json(
        { error: "Field 'genreIds' must be an array of positive integers" },
        { status: 400 }
      );
    }
  }
  if (sortByOverride !== undefined) {
    if (!(MOVIE_SORT_OPTIONS as readonly string[]).includes(sortByOverride as string)) {
      return NextResponse.json(
        { error: `Field 'sortBy' must be one of: ${MOVIE_SORT_OPTIONS.join(", ")}` },
        { status: 400 }
      );
    }
  }
  let minImdb: number | null = null;
  if (minImdbRaw !== undefined) {
    minImdb = Number(minImdbRaw);
    if (!Number.isFinite(minImdb) || minImdb < 0 || minImdb > 10) {
      return NextResponse.json(
        { error: "Field 'minImdb' must be a number between 0 and 10" },
        { status: 400 }
      );
    }
  }
  let minRt: number | null = null;
  if (minRtRaw !== undefined) {
    minRt = Number(minRtRaw);
    if (!Number.isFinite(minRt) || minRt < 0 || minRt > 100) {
      return NextResponse.json(
        { error: "Field 'minRt' must be a number between 0 and 100" },
        { status: 400 }
      );
    }
  }
  if (watchProviderIds !== undefined) {
    if (
      !Array.isArray(watchProviderIds) ||
      !watchProviderIds.every((id) => Number.isInteger(id) && id > 0)
    ) {
      return NextResponse.json(
        { error: "Field 'watchProviderIds' must be an array of positive integers" },
        { status: 400 }
      );
    }
  }
  if (watchRegion !== undefined && !isWatchRegion(watchRegion as string)) {
    return NextResponse.json({ error: "Field 'watchRegion' is not a supported region" }, { status: 400 });
  }

  const overrides = {
    genreIds: genreIdsOverride as number[] | undefined,
    sortBy: sortByOverride as string | undefined,
    watchProviderIds: watchProviderIds as number[] | undefined,
    watchRegion: watchRegion as string | undefined,
  };
  const hasGenreOverride = Boolean(overrides.genreIds && overrides.genreIds.length > 0);

  try {
    const { genres } = await getMovieGenres();

    let genreIds: number[];
    let keywordIds: number[];
    let avoidGenreIds: number[];
    let genreNames: Map<number, string>;
    let keywordNames: Map<number, string>;
    let sortBy: string;
    let yearRange: { gte?: number; lte?: number } | undefined;
    let interpretationGenreNames: string[];
    let resolvedParams: ResolvedMoodParams;

    if (typeof query === "string" && query.trim() !== "") {
      // Fresh query - the only path that spends an Anthropic call, so the
      // only path that's rate-limited.
      if (query.length > MAX_QUERY_LENGTH) {
        return NextResponse.json(
          { error: `Field 'query' must be ${MAX_QUERY_LENGTH} characters or fewer` },
          { status: 400 }
        );
      }
      const { allowed, retryAfterSeconds } = checkRateLimit(
        `movies-mood-search:${getClientIp(request)}`,
        RATE_LIMIT,
        RATE_LIMIT_WINDOW_MS
      );
      if (!allowed) {
        return NextResponse.json(
          { error: "Too many searches — wait a moment and try again." },
          { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
        );
      }

      const interpretation = await interpretMoodQuery(query.trim(), {
        genreNames: genres.map((genre) => genre.name),
        sortOptions: MOVIE_SORT_OPTIONS,
      });
      const resolved = await resolveMoodFilters(interpretation, "movie", genres);
      genreIds = resolved.genreIds;
      keywordIds = resolved.keywordIds;
      avoidGenreIds = resolved.avoidGenreIds;
      genreNames = resolved.genreNames;
      keywordNames = resolved.keywordNames;
      sortBy = resolved.sortBy;
      yearRange = resolved.yearRange;
      interpretationGenreNames = resolved.interpretation.genreNames;
      resolvedParams = toResolvedMoodParams(resolved);
    } else if (isResolvedMoodParams(cachedInterpretation)) {
      // A filter changed while a mood search was already active - reuse
      // the interpretation from the original query instead of re-running
      // it. No LLM call, no rate limit.
      const fromCache = fromResolvedMoodParams(cachedInterpretation);
      genreIds = fromCache.genreIds;
      keywordIds = fromCache.keywordIds;
      avoidGenreIds = fromCache.avoidGenreIds;
      genreNames = fromCache.genreNames;
      keywordNames = fromCache.keywordNames;
      sortBy = fromCache.sortBy;
      yearRange = fromCache.yearRange;
      interpretationGenreNames = cachedInterpretation.genres.map((g) => g.name);
      resolvedParams = cachedInterpretation;
    } else {
      return NextResponse.json(
        { error: "Field 'query' or 'cachedInterpretation' is required" },
        { status: 400 }
      );
    }

    const merged = applyMoodFilterOverrides({ genreIds, sortBy, yearRange }, overrides);
    const mergedSortBy = (MOVIE_SORT_OPTIONS as readonly string[]).includes(merged.sortBy)
      ? (merged.sortBy as MovieSortBy)
      : "popularity.desc";

    const { results: ranked, appliedGenreIds, hasMore } = await discoverAndRankMoodPool(
      (candidateGenreIds, candidateKeywordIds, page, genreMatchMode) =>
        discoverMovies({
          genreIds: candidateGenreIds,
          keywordIds: candidateKeywordIds,
          sortBy: mergedSortBy,
          yearRange: merged.yearRange,
          genreMatchMode,
          watchProviderIds: overrides.watchProviderIds,
          watchRegion: overrides.watchRegion,
          page,
          voteCountGte: POOL_MIN_VOTE_COUNT,
        }),
      merged.genreAttempts,
      keywordIds,
      avoidGenreIds,
      genreNames,
      keywordNames,
      "movie",
      resultsPage
    );
    const enriched = await enrichMoviesWithRatings(ranked);
    const filtered = enriched.filter((movie) => passesRatingFilters(movie.ratings, minImdb, minRt));

    // Once genre is user-overridden, the applied set *is* the user's own
    // checkbox pick (already visible via the filter controls) - showing
    // it again in the mood chips would be redundant and would misrepresent
    // it as something the AI understood. Fall back to the original,
    // unadjusted LLM extraction for the chips in that case.
    const appliedGenreNames = hasGenreOverride
      ? interpretationGenreNames
      : appliedGenreIds
          .map((id) => genreNames.get(id))
          .filter((name): name is string => name !== undefined);
    // Keywords are now always a ranking signal (see discoverAndRankMoodPool
    // in mood-search.ts), not conditionally a hard filter - the chips show
    // the full resolved set unconditionally rather than narrowed to
    // whatever survived the pool's fallback cascade, since even a keyword
    // dropped from the FILTER still influenced which candidates ranked up.
    const keywordTerms = [...keywordNames.values()];

    return NextResponse.json({
      results: filtered,
      interpretation: {
        genreNames: appliedGenreNames,
        keywordTerms,
        sortBy,
        yearRange,
      },
      resolvedParams,
      hasMore,
    });
  } catch (error) {
    if (error instanceof MoodSearchError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof TMDBError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Failed to interpret mood query" },
      { status: 500 }
    );
  }
}
