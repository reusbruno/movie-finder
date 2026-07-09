import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getTVCredits,
  getTVDetails,
  getTVRecommendations,
  TMDBError,
} from "@/lib/tmdb";
import { enrichTVWithRatings, getTVRatings } from "@/lib/ratings";
import { getTVKeywordList } from "@/lib/keywords";
import { getTVWatchProviders } from "@/lib/watch-providers";
import { attachMatchExplanations, explainSingleRefMatch } from "@/lib/match-explanation";
import { isAnthropicAvailable } from "@/lib/anthropic-client";
import { MovieGrid } from "@/components/movie-grid";
import { ScoreBadges } from "@/components/score-badges";
import { CastList } from "@/components/cast-list";
import { WatchProviders } from "@/components/watch-providers";

const MAX_CAST_MEMBERS = 12;
// See src/app/movies/[id]/page.tsx - same rationale: caps OMDb/MDBList/TMDB
// external_ids fan-out for the "More like this" grid to one full grid row.
const MAX_ENRICHED_RECOMMENDATIONS = 8;

const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";

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

  // Started immediately, alongside getTVDetails below - none of these
  // depend on the details response. ownKeywordsPromise feeds "why this
  // match" on the recommendations below and shares the same cache
  // blend/mood search use.
  const recommendationsPromise = getTVRecommendations(tvId);
  const ratingsPromise = getTVRatings(tvId);
  const creditsPromise = getTVCredits(tvId);
  const ownKeywordsPromise = getTVKeywordList(tvId);
  const watchProvidersPromise = getTVWatchProviders(tvId);
  // See src/app/movies/[id]/page.tsx - a bad id 404s on every endpoint, so
  // pre-empt a false "unhandled rejection" if these settle before
  // getTVDetails below; the real error is still observed via Promise.all.
  recommendationsPromise.catch(() => {});
  ratingsPromise.catch(() => {});
  creditsPromise.catch(() => {});
  ownKeywordsPromise.catch(() => {});
  watchProvidersPromise.catch(() => {});

  let details;
  try {
    details = await getTVDetails(tvId);
  } catch (error) {
    if (error instanceof TMDBError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const [recommendations, ratings, credits, ownKeywords, watchProviders] = await Promise.all([
    recommendationsPromise,
    ratingsPromise,
    creditsPromise,
    ownKeywordsPromise,
    watchProvidersPromise,
  ]);
  const genreNames = new Map(details.genres.map((genre) => [genre.id, genre.name]));
  const keywordNames = new Map(ownKeywords.map((keyword) => [keyword.id, keyword.name]));
  const recommendationsWithExplanations = await attachMatchExplanations(
    recommendations.results.slice(0, MAX_ENRICHED_RECOMMENDATIONS),
    "tv",
    genreNames,
    keywordNames,
    (signals) => explainSingleRefMatch(signals, details.title)
  );
  const recommendationsWithRatings = await enrichTVWithRatings(
    recommendationsWithExplanations
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
        <div className="relative aspect-[2/3] w-full max-w-[220px] shrink-0 overflow-hidden rounded-lg bg-black/[.04] dark:bg-white/[.06]">
          {details.poster_path ? (
            <Image
              src={`${POSTER_BASE_URL}${details.poster_path}`}
              alt={`${details.title} poster`}
              fill
              sizes="(min-width: 640px) 220px, 100vw"
              preload
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-center text-sm text-foreground/60">
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

      <WatchProviders region={watchProviders} />

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
        <MovieGrid
          movies={recommendationsWithRatings}
          basePath="series"
          canExplainMore={isAnthropicAvailable()}
        />
      </div>
    </div>
  );
}
