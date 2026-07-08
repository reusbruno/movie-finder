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
    <Link href={`/${basePath}/${movie.id}`} className="flex flex-col gap-2">
      <div className="aspect-[2/3] w-full overflow-hidden rounded-lg bg-black/[.04] dark:bg-white/[.06]">
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
      </div>
      <div className="flex flex-col gap-0.5">
        <h3 className="line-clamp-2 text-sm font-medium leading-tight">
          {movie.title}
        </h3>
        <p className="text-xs text-foreground/60">{year ?? "Unknown year"}</p>
        <p className="text-xs text-foreground/60">
          <ScoreBadges
            tmdbScore={movie.vote_average}
            imdbRating={movie.ratings.imdbRating}
            rtScore={movie.ratings.rottenTomatoesScore}
          />
        </p>
      </div>
    </Link>
  );
}
