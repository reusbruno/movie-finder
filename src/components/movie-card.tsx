import Link from "next/link";
import type { MovieWithRatings } from "@/lib/ratings";
import { ScoreBadges } from "@/components/score-badges";

const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w342";

export function MovieCard({
  movie,
  basePath = "movies",
}: {
  movie: MovieWithRatings;
  basePath?: "movies" | "series";
}) {
  const year = movie.release_date ? movie.release_date.slice(0, 4) : null;

  return (
    <Link
      href={`/${basePath}/${movie.id}`}
      className="group relative block aspect-[2/3] overflow-hidden rounded-lg bg-black/[.04] shadow-none transition-all duration-200 ease-out hover:z-10 hover:scale-[1.04] hover:shadow-lg hover:shadow-black/40 focus-visible:z-10 focus-visible:scale-[1.04] focus-visible:ring-2 focus-visible:ring-accent dark:bg-white/[.06]"
    >
      {movie.poster_path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${POSTER_BASE_URL}${movie.poster_path}`}
          alt={`${movie.title} poster`}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm text-foreground/60">
          No poster available
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pt-8 pb-2">
        <h3 className="line-clamp-2 text-base font-medium leading-tight text-white">
          {movie.title}
        </h3>
        <div className="grid grid-rows-[0fr] opacity-0 transition-all duration-200 ease-out group-hover:grid-rows-[1fr] group-hover:opacity-100 group-focus-visible:grid-rows-[1fr] group-focus-visible:opacity-100">
          <div className="overflow-hidden">
            <p className="pt-1 text-xs text-white/70">
              {year ?? "Unknown year"}
            </p>
            <p className="text-xs text-white/80">
              <ScoreBadges
                tmdbScore={movie.vote_average}
                imdbRating={movie.ratings.imdbRating}
                rtScore={movie.ratings.rottenTomatoesScore}
              />
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
