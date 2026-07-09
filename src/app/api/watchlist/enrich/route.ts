import { NextRequest, NextResponse } from "next/server";
import {
  getMovieDetails,
  getTVDetails,
  type TMDBMovie,
  type TMDBMovieDetails,
  type TMDBTVDetails,
} from "@/lib/tmdb";
import { getMovieRatings, getTVRatings } from "@/lib/ratings";

// The watchlist itself lives in the browser's localStorage (see
// src/lib/watchlist.ts) and only ever stores id/mediaType/title/posterPath -
// this route re-fetches everything else (current rating, whether the title
// still exists on TMDB at all) fresh on every watchlist page load, rather
// than trusting a stale snapshot from whenever the title was added.
const MAX_ITEMS = 100;

interface WatchlistLookup {
  id: number;
  mediaType: "movie" | "tv";
}

function isWatchlistLookup(value: unknown): value is WatchlistLookup {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { id?: unknown; mediaType?: unknown };
  return (
    typeof candidate.id === "number" &&
    (candidate.mediaType === "movie" || candidate.mediaType === "tv")
  );
}

// Movie/TV details responses use the same field names for everything a card
// needs except genre_ids (they carry a `genres` array instead) - reshape
// into the same TMDBMovie shape MovieCard/MovieGrid already render.
function toCardShape(details: TMDBMovieDetails | TMDBTVDetails): TMDBMovie {
  return {
    id: details.id,
    title: details.title,
    original_title: details.original_title,
    overview: details.overview,
    release_date: details.release_date,
    poster_path: details.poster_path,
    backdrop_path: details.backdrop_path,
    vote_average: details.vote_average,
    vote_count: details.vote_count,
    popularity: details.popularity,
    genre_ids: details.genres.map((genre) => genre.id),
    original_language: details.original_language,
    adult: details.adult,
  };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const rawItems = (body as { items?: unknown } | null)?.items;
  if (!Array.isArray(rawItems)) {
    return NextResponse.json({ error: "Field 'items' must be an array" }, { status: 400 });
  }

  const items = rawItems.filter(isWatchlistLookup).slice(0, MAX_ITEMS);

  const enriched = await Promise.all(
    items.map(async ({ id, mediaType }) => {
      try {
        const [details, ratings] =
          mediaType === "movie"
            ? await Promise.all([getMovieDetails(id), getMovieRatings(id)])
            : await Promise.all([getTVDetails(id), getTVRatings(id)]);
        return { ...toCardShape(details), ratings, mediaType };
      } catch {
        // A title that 404s (removed from TMDB, or a stale/bad stored id)
        // just drops out of the response - the watchlist page shows
        // whatever still resolves rather than erroring the whole page.
        return null;
      }
    })
  );

  return NextResponse.json({
    items: enriched.filter((item) => item !== null),
  });
}
