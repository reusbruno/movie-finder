import { NextRequest, NextResponse } from "next/server";
import { searchMovies, TMDBError } from "@/lib/tmdb";
import { enrichMoviesWithRatings } from "@/lib/ratings";
import { TMDB_LANGUAGE } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n";
import { resolveLocale } from "@/lib/i18n/request";
import { filterByPersonalStatus, isMyStatusFilter } from "@/lib/watchlist-filter";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("query");
  const pageParam = searchParams.get("page");

  const resolved = resolveLocale(searchParams.get("language"));
  if (!resolved.ok) return resolved.response;
  const { locale } = resolved;

  if (!query || query.trim().length === 0) {
    return NextResponse.json(
      { error: "Query parameter 'query' is required" },
      { status: 400 }
    );
  }

  const page = pageParam ? Number(pageParam) : 1;
  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json(
      { error: "Query parameter 'page' must be a positive integer" },
      { status: 400 }
    );
  }

  const myStatusParam = searchParams.get("my_status");
  if (myStatusParam && !isMyStatusFilter(myStatusParam)) {
    return NextResponse.json(
      { error: "Query parameter 'my_status' must be one of: all, watched, unwatched" },
      { status: 400 }
    );
  }
  const myStatus = myStatusParam && isMyStatusFilter(myStatusParam) ? myStatusParam : "all";

  const minRatingParam = searchParams.get("min_rating");
  let minRating: number | null = null;
  if (minRatingParam) {
    minRating = Number(minRatingParam);
    if (!Number.isInteger(minRating) || minRating < 1 || minRating > 5) {
      return NextResponse.json(
        { error: "Query parameter 'min_rating' must be an integer between 1 and 5" },
        { status: 400 }
      );
    }
  }

  try {
    const results = await searchMovies(query, page, TMDB_LANGUAGE[locale]);
    const enriched = await enrichMoviesWithRatings(results.results);
    const personalized = await filterByPersonalStatus(enriched, "movie", myStatus, minRating);
    return NextResponse.json({ ...results, results: personalized });
  } catch (error) {
    if (error instanceof TMDBError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: getDictionary(locale).serverErrors.failedToSearchMovies },
      { status: 500 }
    );
  }
}
