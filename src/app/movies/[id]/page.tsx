import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getMovieDetails,
  getMovieRecommendations,
  TMDBError,
} from "@/lib/tmdb";
import { getMovieRatingsByImdbId } from "@/lib/omdb";
import { enrichMoviesWithRatings } from "@/lib/ratings";
import { MovieGrid } from "@/components/movie-grid";
import { ScoreBadges } from "@/components/score-badges";

const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w342";

export default async function MovieDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const movieId = Number(id);

  if (!Number.isInteger(movieId) || movieId < 1) {
    notFound();
  }

  let details;
  try {
    details = await getMovieDetails(movieId);
  } catch (error) {
    if (error instanceof TMDBError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const [recommendations, ratings] = await Promise.all([
    getMovieRecommendations(movieId),
    details.imdb_id
      ? getMovieRatingsByImdbId(details.imdb_id)
      : Promise.resolve({ imdbRating: null, rottenTomatoesScore: null }),
  ]);
  const recommendationsWithRatings = await enrichMoviesWithRatings(
    recommendations.results
  );
  const year = details.release_date ? details.release_date.slice(0, 4) : null;

  return (
    <div className="flex flex-1 flex-col gap-10 px-6 py-8">
      <Link
        href="/movies"
        className="w-fit text-sm text-foreground/60 hover:text-foreground"
      >
        ← Back to Movies
      </Link>
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="w-full max-w-[220px] shrink-0 overflow-hidden rounded-lg bg-black/[.04] dark:bg-white/[.06]">
          {details.poster_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${POSTER_BASE_URL}${details.poster_path}`}
              alt={`${details.title} poster`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[2/3] items-center justify-center p-4 text-center text-sm text-foreground/60">
              No poster available
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {details.title}
            {year && (
              <span className="ml-2 font-normal text-foreground/60">
                ({year})
              </span>
            )}
          </h1>
          {details.tagline && (
            <p className="italic text-foreground/60">{details.tagline}</p>
          )}
          <p className="text-sm text-foreground/60">
            <ScoreBadges
              tmdbScore={details.vote_average}
              imdbRating={ratings.imdbRating}
              rtScore={ratings.rottenTomatoesScore}
            />
            {details.runtime ? ` · ${details.runtime} min` : ""}
            {details.genres.length > 0
              ? ` · ${details.genres.map((genre) => genre.name).join(", ")}`
              : ""}
          </p>
          <p className="max-w-2xl text-sm leading-relaxed">
            {details.overview}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">
          More like this
        </h2>
        <MovieGrid movies={recommendationsWithRatings} />
      </div>
    </div>
  );
}
