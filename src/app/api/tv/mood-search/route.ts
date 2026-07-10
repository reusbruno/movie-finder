import { NextRequest, NextResponse } from "next/server";
import {
  discoverTV,
  getTVGenres,
  TV_SORT_OPTIONS,
  TMDBError,
  type TVSortBy,
} from "@/lib/tmdb";
import { enrichTVWithRatings } from "@/lib/ratings";
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
// See src/app/api/movies/mood-search/route.ts - same policy, separate
// bucket per route.
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
    `tv-mood-search:${getClientIp(request)}`,
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
    const { genres } = await getTVGenres();
    const interpretation = await interpretMoodQuery(query.trim(), {
      genreNames: genres.map((genre) => genre.name),
      sortOptions: TV_SORT_OPTIONS,
    });
    const resolved = await resolveMoodFilters(interpretation, "tv", genres);
    const sortBy = (TV_SORT_OPTIONS as readonly string[]).includes(resolved.sortBy)
      ? (resolved.sortBy as TVSortBy)
      : "popularity.desc";

    const { appliedGenreIds, appliedKeywordIds, ...results } = await discoverWithMoodFallback(
      (genreIds, keywordIds) =>
        discoverTV({
          genreIds,
          keywordIds,
          sortBy,
          yearRange: resolved.yearRange,
          // See src/app/api/movies/mood-search/route.ts - genre is a hard
          // filter for mood search, unlike the browse page's OR checkboxes.
          genreMatchMode: "all",
        }),
      resolved.genreIds,
      resolved.keywordIds
    );
    const withExplanations = await attachMatchExplanations(
      results.results,
      "tv",
      resolved.genreNames,
      resolved.keywordNames,
      explainMoodMatch
    );
    const enriched = await enrichTVWithRatings(withExplanations);
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
