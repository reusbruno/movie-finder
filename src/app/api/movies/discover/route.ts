import { NextRequest, NextResponse } from "next/server";
import {
  discoverMovies,
  MOVIE_SORT_OPTIONS,
  TMDB_MAX_DISCOVER_PAGE,
  TMDBError,
  type MovieSortBy,
} from "@/lib/tmdb";
import { enrichMoviesWithRatings, passesRatingFilters } from "@/lib/ratings";
import { isWatchRegion } from "@/lib/watch-providers";
import { TMDB_LANGUAGE } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n";
import { resolveLocale } from "@/lib/i18n/request";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const genresParam = searchParams.get("genres");
  const sortParam = searchParams.get("sort_by");
  const pageParam = searchParams.get("page");

  const resolved = resolveLocale(searchParams.get("language"));
  if (!resolved.ok) return resolved.response;
  const { locale } = resolved;

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

  const sortBy = (sortParam ?? "popularity.desc") as MovieSortBy;
  if (!MOVIE_SORT_OPTIONS.includes(sortBy)) {
    return NextResponse.json(
      { error: `Query parameter 'sort_by' must be one of: ${MOVIE_SORT_OPTIONS.join(", ")}` },
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

  const watchProvidersParam = searchParams.get("watch_providers");
  const watchProviderIds = watchProvidersParam
    ? watchProvidersParam
        .split(",")
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0)
    : [];
  if (watchProvidersParam && watchProviderIds.length === 0) {
    return NextResponse.json(
      { error: "Query parameter 'watch_providers' must be a comma-separated list of ids" },
      { status: 400 }
    );
  }

  const regionParam = searchParams.get("region");
  if (regionParam && !isWatchRegion(regionParam)) {
    return NextResponse.json(
      { error: "Query parameter 'region' is not a supported region" },
      { status: 400 }
    );
  }
  if (watchProviderIds.length > 0 && !regionParam) {
    return NextResponse.json(
      { error: "Query parameter 'region' is required when 'watch_providers' is set" },
      { status: 400 }
    );
  }

  try {
    const results = await discoverMovies({
      genreIds,
      sortBy,
      page,
      watchProviderIds,
      watchRegion: regionParam ?? undefined,
      language: TMDB_LANGUAGE[locale],
    });
    const enriched = await enrichMoviesWithRatings(results.results);
    const filtered = enriched.filter((movie) =>
      passesRatingFilters(movie.ratings, minImdb, minRt)
    );
    return NextResponse.json({ ...results, results: filtered });
  } catch (error) {
    if (error instanceof TMDBError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: getDictionary(locale).serverErrors.failedToDiscoverMovies },
      { status: 500 }
    );
  }
}
