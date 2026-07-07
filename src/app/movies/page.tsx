import { getPopularMovies } from "@/lib/tmdb";
import { MovieSearch } from "@/components/movie-search";

export default async function MoviesPage() {
  const popular = await getPopularMovies();

  return <MovieSearch initialMovies={popular.results} />;
}
