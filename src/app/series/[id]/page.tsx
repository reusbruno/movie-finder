import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getTVCredits,
  getTVDetails,
  getTVRecommendations,
  TMDBError,
} from "@/lib/tmdb";
import { enrichTVWithRatings, getTVRatings } from "@/lib/ratings";
import { MovieGrid } from "@/components/movie-grid";
import { ScoreBadges } from "@/components/score-badges";
import { CastList } from "@/components/cast-list";

const MAX_CAST_MEMBERS = 12;

const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w342";

export default async function SeriesDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tvId = Number(id);

  if (!Number.isInteger(tvId) || tvId < 1) {
    notFound();
  }

  let details;
  try {
    details = await getTVDetails(tvId);
  } catch (error) {
    if (error instanceof TMDBError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const [recommendations, ratings, credits] = await Promise.all([
    getTVRecommendations(tvId),
    getTVRatings(tvId),
    getTVCredits(tvId),
  ]);
  const recommendationsWithRatings = await enrichTVWithRatings(
    recommendations.results
  );
  const topCast = [...credits.cast]
    .sort((a, b) => a.order - b.order)
    .slice(0, MAX_CAST_MEMBERS);
  const year = details.release_date ? details.release_date.slice(0, 4) : null;

  return (
    <div className="flex flex-1 flex-col gap-10 px-6 py-8">
      <Link
        href="/series"
        className="w-fit text-sm text-foreground/60 hover:text-foreground"
      >
        ← Back to Series
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
            {` · ${details.number_of_seasons} season${details.number_of_seasons === 1 ? "" : "s"}`}
            {` · ${details.number_of_episodes} episodes`}
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
          <h2 className="text-lg font-semibold tracking-tight">Cast</h2>
          <CastList cast={topCast} />
        </div>
      )}

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">
          More like this
        </h2>
        <MovieGrid movies={recommendationsWithRatings} basePath="series" />
      </div>
    </div>
  );
}
