import { getMovieGenres, getPopularMovies } from "@/lib/tmdb";
import { enrichMoviesWithRatings } from "@/lib/ratings";
import { MoviesView } from "@/components/movies-view";

export default async function MoviesPage() {
  const [popular, genres] = await Promise.all([
    getPopularMovies(),
    getMovieGenres(),
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
