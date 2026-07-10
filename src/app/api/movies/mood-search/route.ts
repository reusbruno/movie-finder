import { NextRequest, NextResponse } from "next/server";
import {
  discoverMovies,
  getMovieGenres,
  MOVIE_SORT_OPTIONS,
  TMDBError,
  type MovieSortBy,
} from "@/lib/tmdb";
import { enrichMoviesWithRatings } from "@/lib/ratings";
import {
  interpretMoodQuery,
  isMoodSearchAvailable,
  resolveMoodFilters,
  discoverWithMoodFallback,
  MoodSearchError,
} from "@/lib/mood-search";
import { attachMatchExplanations, explainMoodMatch } from "@/lib/match-explanation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const MAX_QUERY_LENGTH = 300;
// This route spends Anthropic credits per call - generous for a human
// typing queries, tight enough to blunt a script hammering it.
const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

export async function GET() {
  return NextResponse.json({ available: isMoodSearchAvailable() });
}

export async function POST(request: NextRequest) {
  if (!isMoodSearchAvailable()) {
    return NextResponse.json({ error: "Mood search is not configured" }, { status: 503 });
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const query = (body as { query?: unknown } | null)?.query;
  if (typeof query !== "string" || query.trim() === "") {
    return NextResponse.json({ error: "Field 'query' is required" }, { status: 400 });
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: `Field 'query' must be ${MAX_QUERY_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }

  try {
    const { genres } = await getMovieGenres();
    const interpretation = await interpretMoodQuery(query.trim(), {
      genreNames: genres.map((genre) => genre.name),
      sortOptions: MOVIE_SORT_OPTIONS,
    });
    const resolved = await resolveMoodFilters(interpretation, "movie", genres);
    const sortBy = (MOVIE_SORT_OPTIONS as readonly string[]).includes(resolved.sortBy)
      ? (resolved.sortBy as MovieSortBy)
      : "popularity.desc";

    const { appliedGenreIds, appliedKeywordIds, ...results } = await discoverWithMoodFallback(
      (genreIds, keywordIds) =>
        discoverMovies({
          genreIds,
          keywordIds,
          sortBy,
          yearRange: resolved.yearRange,
          // A mood's genres are a hard filter (must be Sci-Fi, not just
          // "has some genre in common"), unlike the browse page's
          // OR-by-default genre checkboxes - see discoverMovies.
          genreMatchMode: "all",
        }),
      resolved.genreIds,
      resolved.keywordIds
    );
    const withExplanations = await attachMatchExplanations(
      results.results,
      "movie",
      resolved.genreNames,
      resolved.keywordNames,
      explainMoodMatch
    );
    const enriched = await enrichMoviesWithRatings(withExplanations);
    const appliedGenreNames = appliedGenreIds
      .map((id) => resolved.genreNames.get(id))
      .filter((name): name is string => name !== undefined);
    const appliedKeywordTerms = appliedKeywordIds
      .map((id) => resolved.keywordNames.get(id))
      .filter((name): name is string => name !== undefined);

    return NextResponse.json({
      ...results,
      results: enriched,
      interpretation: {
        ...resolved.interpretation,
        genreNames: appliedGenreNames,
        keywordTerms: appliedKeywordTerms,
      },
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
