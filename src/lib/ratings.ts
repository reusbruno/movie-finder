import {
  getMovieExternalIds,
  getTVExternalIds,
  type TMDBMovie,
} from "@/lib/tmdb";
import { getMovieRatingsByImdbId, type MovieRatings } from "@/lib/omdb";
import { getRottenTomatoesScore } from "@/lib/mdblist";

const EMPTY_RATINGS: MovieRatings = {
  imdbRating: null,
  rottenTomatoesScore: null,
};

type MediaType = "movie" | "tv";

// In-process memoization only: no persistence, no TTL, resets on every
// server restart. Just avoids re-fetching OMDb for the same title
// repeatedly within one dev/server run (e.g. reloading the same
// Popular grid). Not the caching layer the build plan defers. Keyed by
// media type + id since movie and TV ids are separate TMDB id spaces.
const ratingsCache = new Map<string, Promise<MovieRatings>>();

async function fetchRatings(
  mediaType: MediaType,
  tmdbId: number
): Promise<MovieRatings> {
  const externalIds =
    mediaType === "movie"
      ? await getMovieExternalIds(tmdbId)
      : await getTVExternalIds(tmdbId);

  if (!externalIds.imdb_id) {
    return EMPTY_RATINGS;
  }

  const omdbRatings = await getMovieRatingsByImdbId(externalIds.imdb_id);

  if (omdbRatings.rottenTomatoesScore !== null) {
    return omdbRatings;
  }

  // OMDb has no RT score for this title (common for TV) - try MDBList as
  // a fallback. Best-effort only: any failure here (missing key, network
  // error, title not in MDBList either) just keeps OMDb's null result
  // rather than breaking the whole rating fetch.
  try {
    const fallbackScore = await getRottenTomatoesScore(
      externalIds.imdb_id,
      mediaType
    );
    if (fallbackScore !== null) {
      return { ...omdbRatings, rottenTomatoesScore: fallbackScore };
    }
  } catch {
    // swallow - fallback is advisory only
  }

  return omdbRatings;
}

function getRatings(mediaType: MediaType, tmdbId: number): Promise<MovieRatings> {
  const key = `${mediaType}:${tmdbId}`;
  let cached = ratingsCache.get(key);
  if (!cached) {
    // Ratings are a nice-to-have enrichment, never the reason a page should
    // fail to render - any failure (rate limit, network error, whatever)
    // degrades to "no ratings available" for this title, same as the
    // existing null-handling for a missing RT score. The cache entry is
    // still cleared on failure so a transient error doesn't get stuck
    // forever; logged so a real, ongoing problem (e.g. a spent OMDb quota)
    // is actually visible instead of silently invisible everywhere.
    cached = fetchRatings(mediaType, tmdbId).catch((error: unknown) => {
      ratingsCache.delete(key);
      console.error(`Ratings fetch failed for ${key}, degrading to no ratings:`, error);
      return EMPTY_RATINGS;
    });
    ratingsCache.set(key, cached);
  }
  return cached;
}

export function getMovieRatings(tmdbId: number): Promise<MovieRatings> {
  return getRatings("movie", tmdbId);
}

export function getTVRatings(tmdbId: number): Promise<MovieRatings> {
  return getRatings("tv", tmdbId);
}

export type MovieWithRatings = TMDBMovie & { ratings: MovieRatings };

async function enrichWithRatings(
  mediaType: MediaType,
  items: TMDBMovie[]
): Promise<MovieWithRatings[]> {
  const settled = await Promise.allSettled(
    items.map((item) => getRatings(mediaType, item.id))
  );

  return items.map((item, index) => {
    const result = settled[index];
    return {
      ...item,
      ratings: result.status === "fulfilled" ? result.value : EMPTY_RATINGS,
    };
  });
}

export function enrichMoviesWithRatings(
  movies: TMDBMovie[]
): Promise<MovieWithRatings[]> {
  return enrichWithRatings("movie", movies);
}

export function enrichTVWithRatings(
  shows: TMDBMovie[]
): Promise<MovieWithRatings[]> {
  return enrichWithRatings("tv", shows);
}

export function passesRatingFilters(
  ratings: MovieRatings,
  minImdb: number | null,
  minRt: number | null
): boolean {
  if (
    minImdb !== null &&
    ratings.imdbRating !== null &&
    ratings.imdbRating < minImdb
  ) {
    return false;
  }
  if (
    minRt !== null &&
    ratings.rottenTomatoesScore !== null &&
    ratings.rottenTomatoesScore < minRt
  ) {
    return false;
  }
  return true;
}
