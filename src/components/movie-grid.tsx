import type { MovieWithRatings } from "@/lib/ratings";
import { MovieCard } from "@/components/movie-card";

export function MovieGrid({ movies }: { movies: MovieWithRatings[] }) {
  if (movies.length === 0) {
    return (
      <p className="py-16 text-center text-foreground/60">No movies found.</p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {movies.map((movie) => (
        <MovieCard key={movie.id} movie={movie} />
      ))}
    </div>
  );
}
