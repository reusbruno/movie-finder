import { getMovieGenres, getPopularMovies } from "@/lib/tmdb";
import { enrichMoviesWithRatings } from "@/lib/ratings";
import { MoviesView } from "@/components/movies-view";
import { DEFAULT_LOCALE, TMDB_LANGUAGE } from "@/lib/i18n/locale";

// Server Components have no access to the client's persisted locale (no
// cookies/middleware in this app) - always seeds in the app-wide default
// (pt-BR). MediaExplorer compares this known default against the real
// resolved locale on mount and self-corrects (re-fetches Popular + genres)
// only when they differ - see media-explorer.tsx.
const SSR_LANGUAGE = TMDB_LANGUAGE[DEFAULT_LOCALE];

export default async function MoviesPage() {
  const [popular, genres] = await Promise.all([
    getPopularMovies(1, SSR_LANGUAGE),
    getMovieGenres(SSR_LANGUAGE),
  ]);
  const initialMovies = await enrichMoviesWithRatings(popular.results);

  return (
    <MoviesView
      initialMovies={initialMovies}
      initialTotalPages={popular.total_pages}
      genres={genres.genres}
    />
  );
}
