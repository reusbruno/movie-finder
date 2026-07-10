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
  MoodSearchError,
} from "@/lib/mood-search";
import { attachMatchExplanations, explainMoodMatch } from "@/lib/match-explanation";

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
    const { genres } = await getMovieGenres();
    const interpretation = await interpretMoodQuery(query.trim(), {
      genreNames: genres.map((genre) => genre.name),
      sortOptions: MOVIE_SORT_OPTIONS,
    });
    const resolved = await resolveMoodFilters(interpretation, "movie", genres);
    const sortBy = (MOVIE_SORT_OPTIONS as readonly string[]).includes(resolved.sortBy)
      ? (resolved.sortBy as MovieSortBy)
      : "popularity.desc";

    const results = await discoverMovies({
      genreIds: resolved.genreIds,
      keywordIds: resolved.keywordIds,
      sortBy,
      yearRange: resolved.yearRange,
      // A mood's genres are a hard filter (must be Sci-Fi, not just "has
      // some genre in common"), unlike the browse page's OR-by-default
      // genre checkboxes - see discoverMovies.
      genreMatchMode: "all",
    });
    const withExplanations = await attachMatchExplanations(
      results.results,
      "movie",
      resolved.genreNames,
      resolved.keywordNames,
      explainMoodMatch
    );
    const enriched = await enrichMoviesWithRatings(withExplanations);

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
