import { getMovieExternalIds, type TMDBMovie } from "@/lib/tmdb";
import { getMovieRatingsByImdbId, type MovieRatings } from "@/lib/omdb";

const EMPTY_RATINGS: MovieRatings = {
  imdbRating: null,
  rottenTomatoesScore: null,
};

// In-process memoization only: no persistence, no TTL, resets on every
// server restart. Just avoids re-fetching OMDb for the same movie
// repeatedly within one dev/server run (e.g. reloading the same
// Popular grid). Not the caching layer the build plan defers.
const ratingsCache = new Map<number, Promise<MovieRatings>>();

async function fetchRatingsForMovie(tmdbId: number): Promise<MovieRatings> {
  const externalIds = await getMovieExternalIds(tmdbId);
  if (!externalIds.imdb_id) {
    return EMPTY_RATINGS;
  }
  return getMovieRatingsByImdbId(externalIds.imdb_id);
}

export function getMovieRatings(tmdbId: number): Promise<MovieRatings> {
  let cached = ratingsCache.get(tmdbId);
  if (!cached) {
    cached = fetchRatingsForMovie(tmdbId).catch((error: unknown) => {
      ratingsCache.delete(tmdbId);
      throw error;
    });
    ratingsCache.set(tmdbId, cached);
  }
  return cached;
}

export type MovieWithRatings = TMDBMovie & { ratings: MovieRatings };

export async function enrichMoviesWithRatings(
  movies: TMDBMovie[]
): Promise<MovieWithRatings[]> {
  const settled = await Promise.allSettled(
    movies.map((movie) => getMovieRatings(movie.id))
  );

  return movies.map((movie, index) => {
    const result = settled[index];
    return {
      ...movie,
      ratings: result.status === "fulfilled" ? result.value : EMPTY_RATINGS,
    };
  });
}
