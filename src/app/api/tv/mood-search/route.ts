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
  MoodSearchError,
} from "@/lib/mood-search";

const MAX_QUERY_LENGTH = 300;

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

    const results = await discoverTV({
      genreIds: resolved.genreIds,
      keywordIds: resolved.keywordIds,
      sortBy,
      yearRange: resolved.yearRange,
    });
    const enriched = await enrichTVWithRatings(results.results);

    return NextResponse.json({
      ...results,
      results: enriched,
      interpretation: resolved.interpretation,
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
