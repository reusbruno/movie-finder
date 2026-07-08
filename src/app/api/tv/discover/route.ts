import { NextRequest, NextResponse } from "next/server";
import {
  discoverTV,
  TMDB_MAX_DISCOVER_PAGE,
  TMDBError,
  TV_SORT_OPTIONS,
  type TVSortBy,
} from "@/lib/tmdb";
import { enrichTVWithRatings, passesRatingFilters } from "@/lib/ratings";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const genresParam = searchParams.get("genres");
  const sortParam = searchParams.get("sort_by");
  const pageParam = searchParams.get("page");

  const genreIds = genresParam
    ? genresParam
        .split(",")
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0)
    : [];

  if (genresParam && genreIds.length === 0) {
    return NextResponse.json(
      { error: "Query parameter 'genres' must be a comma-separated list of ids" },
      { status: 400 }
    );
  }

  const sortBy = (sortParam ?? "popularity.desc") as TVSortBy;
  if (!TV_SORT_OPTIONS.includes(sortBy)) {
    return NextResponse.json(
      { error: `Query parameter 'sort_by' must be one of: ${TV_SORT_OPTIONS.join(", ")}` },
      { status: 400 }
    );
  }

  const page = pageParam ? Number(pageParam) : 1;
  if (!Number.isInteger(page) || page < 1 || page > TMDB_MAX_DISCOVER_PAGE) {
    return NextResponse.json(
      {
        error: `Query parameter 'page' must be a positive integer up to ${TMDB_MAX_DISCOVER_PAGE}`,
      },
      { status: 400 }
    );
  }

  const minImdbParam = searchParams.get("min_imdb");
  let minImdb: number | null = null;
  if (minImdbParam) {
    minImdb = Number(minImdbParam);
    if (!Number.isFinite(minImdb) || minImdb < 0 || minImdb > 10) {
      return NextResponse.json(
        { error: "Query parameter 'min_imdb' must be a number between 0 and 10" },
        { status: 400 }
      );
    }
  }

  const minRtParam = searchParams.get("min_rt");
  let minRt: number | null = null;
  if (minRtParam) {
    minRt = Number(minRtParam);
    if (!Number.isFinite(minRt) || minRt < 0 || minRt > 100) {
      return NextResponse.json(
        { error: "Query parameter 'min_rt' must be a number between 0 and 100" },
        { status: 400 }
      );
    }
  }

  try {
    const results = await discoverTV({ genreIds, sortBy, page });
    const enriched = await enrichTVWithRatings(results.results);
    const filtered = enriched.filter((show) =>
      passesRatingFilters(show.ratings, minImdb, minRt)
    );
    return NextResponse.json({ ...results, results: filtered });
  } catch (error) {
    if (error instanceof TMDBError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Failed to discover TV shows" },
      { status: 500 }
    );
  }
}
