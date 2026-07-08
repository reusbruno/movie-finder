import type { MovieWithRatings } from "@/lib/ratings";
import { MovieCard } from "@/components/movie-card";
import { gridItemVisibilityClass } from "@/lib/grid-visibility";

export function MovieGrid({
  movies,
  basePath = "movies",
}: {
  movies: MovieWithRatings[];
  basePath?: "movies" | "series";
}) {
  if (movies.length === 0) {
    return (
      <p className="py-16 text-center text-foreground/60">No movies found.</p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
      {movies.map((movie, index) => (
        <div
          key={movie.id}
          className={gridItemVisibilityClass(index, movies.length)}
        >
          <MovieCard movie={movie} basePath={basePath} priority={index === 0} />
        </div>
      ))}
    </div>
  );
}
