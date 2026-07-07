import { getMovieGenres, getPopularMovies } from "@/lib/tmdb";
import { MoviesView } from "@/components/movies-view";

export default async function MoviesPage() {
  const [popular, genres] = await Promise.all([
    getPopularMovies(),
    getMovieGenres(),
  ]);

  return (
    <MoviesView initialMovies={popular.results} genres={genres.genres} />
  );
}
