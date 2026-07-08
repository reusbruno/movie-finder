import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getMovieCredits,
  getMovieDetails,
  getMovieRecommendations,
  TMDBError,
} from "@/lib/tmdb";
import { getMovieRatingsByImdbId, type MovieRatings } from "@/lib/omdb";
import { enrichMoviesWithRatings } from "@/lib/ratings";
import { MovieGrid } from "@/components/movie-grid";
import { ScoreBadges } from "@/components/score-badges";
import { CastList } from "@/components/cast-list";

const MAX_CAST_MEMBERS = 12;
const NO_RATINGS: MovieRatings = { imdbRating: null, rottenTomatoesScore: null };

const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w342";

// Ratings are an enrichment, never a reason this page should fail to
// render - any failure (rate limit, network error, etc.) degrades to "no
// ratings available" rather than throwing, same as ratings.ts's resilience
// for the grid. Called directly with the already-known imdb_id (not via
// ratings.ts's getMovieRatings) to avoid a redundant external_ids lookup,
// since TMDB's movie details response already includes it.
async function fetchOwnRatings(imdbId: string | null): Promise<MovieRatings> {
  if (!imdbId) return NO_RATINGS;
  try {
    return await getMovieRatingsByImdbId(imdbId);
  } catch (error) {
    console.error(`Ratings fetch failed for movie imdb:${imdbId}, degrading to no ratings:`, error);
    return NO_RATINGS;
  }
}

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

  const [recommendations, ratings, credits] = await Promise.all([
    getMovieRecommendations(movieId),
    fetchOwnRatings(details.imdb_id),
    getMovieCredits(movieId),
  ]);
  const recommendationsWithRatings = await enrichMoviesWithRatings(
    recommendations.results
  );
  const topCast = [...credits.cast]
    .sort((a, b) => a.order - b.order)
    .slice(0, MAX_CAST_MEMBERS);
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
          <h1 className="font-display text-xl tracking-wide">
            {details.title}
            {year && (
              <span className="ml-2 text-lg text-foreground/60">
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

      {topCast.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-lg tracking-wide">Cast</h2>
          <CastList cast={topCast} />
        </div>
      )}

      <div className="flex flex-col gap-4">
        <h2 className="font-display text-lg tracking-wide">
          More like this
        </h2>
        <MovieGrid movies={recommendationsWithRatings} />
      </div>
    </div>
  );
}
