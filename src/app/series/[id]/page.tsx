import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getTVCredits,
  getTVDetails,
  getTVRecommendations,
  getTVVideos,
  TMDBError,
} from "@/lib/tmdb";
import { enrichTVWithRatings, getTVRatings } from "@/lib/ratings";
import { getTVKeywordList } from "@/lib/keywords";
import { DEFAULT_WATCH_REGION, getTVWatchProviders } from "@/lib/watch-providers";
import { attachMatchExplanations, explainSingleRefMatch } from "@/lib/match-explanation";
import { selectTrailer } from "@/lib/trailer";
import { isAnthropicAvailable } from "@/lib/anthropic-client";
import { MovieGrid } from "@/components/movie-grid";
import { ScoreBadges } from "@/components/score-badges";
import { CastList } from "@/components/cast-list";
import { WatchProviders } from "@/components/watch-providers";
import { TrailerButton } from "@/components/trailer-button";
import { isLocale, DEFAULT_LOCALE, TMDB_LANGUAGE } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n";

const MAX_CAST_MEMBERS = 12;
// See src/app/movies/[id]/page.tsx - same rationale: caps OMDb/MDBList/TMDB
// external_ids fan-out for the "More like this" grid to one full grid row.
const MAX_ENRICHED_RECOMMENDATIONS = 8;

const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";

export default async function SeriesDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  // See src/app/movies/[id]/page.tsx - same searchParams.lang reasoning.
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params;
  const tvId = Number(id);
  const { lang } = await searchParams;

  if (!Number.isInteger(tvId) || tvId < 1) {
    notFound();
  }

  const locale = lang && isLocale(lang) ? lang : DEFAULT_LOCALE;
  const language = TMDB_LANGUAGE[locale];
  const t = getDictionary(locale);

  // Started immediately, alongside getTVDetails below - none of these
  // depend on the details response. ownKeywordsPromise feeds "why this
  // match" on the recommendations below and shares the same cache
  // blend/mood search use.
  const recommendationsPromise = getTVRecommendations(tvId, 1, language);
  const ratingsPromise = getTVRatings(tvId);
  const creditsPromise = getTVCredits(tvId, language);
  const ownKeywordsPromise = getTVKeywordList(tvId);
  // See src/app/movies/[id]/page.tsx - server always fetches the default
  // region; the client component re-fetches if the visitor's persisted
  // region differs.
  const watchProvidersPromise = getTVWatchProviders(tvId, DEFAULT_WATCH_REGION);
  // See src/app/movies/[id]/page.tsx - not passed `language`, trailer
  // selection is language-independent by design.
  const videosPromise = getTVVideos(tvId);
  // See src/app/movies/[id]/page.tsx - a bad id 404s on every endpoint, so
  // pre-empt a false "unhandled rejection" if these settle before
  // getTVDetails below; the real error is still observed via Promise.all.
  recommendationsPromise.catch(() => {});
  ratingsPromise.catch(() => {});
  creditsPromise.catch(() => {});
  ownKeywordsPromise.catch(() => {});
  watchProvidersPromise.catch(() => {});
  videosPromise.catch(() => {});

  let details;
  try {
    details = await getTVDetails(tvId, language);
  } catch (error) {
    if (error instanceof TMDBError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const [recommendations, ratings, credits, ownKeywords, watchProviders, videos] =
    await Promise.all([
      recommendationsPromise,
      ratingsPromise,
      creditsPromise,
      ownKeywordsPromise,
      watchProvidersPromise,
      videosPromise,
    ]);
  const trailer = selectTrailer(videos.results);
  const genreNames = new Map(details.genres.map((genre) => [genre.id, genre.name]));
  const keywordNames = new Map(ownKeywords.map((keyword) => [keyword.id, keyword.name]));
  const recommendationsWithExplanations = await attachMatchExplanations(
    recommendations.results.slice(0, MAX_ENRICHED_RECOMMENDATIONS),
    "tv",
    genreNames,
    keywordNames,
    (signals) => explainSingleRefMatch(signals, details.title, locale)
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
        {t.detail.backToSeries}
      </Link>
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="relative aspect-[2/3] w-full max-w-[220px] shrink-0 overflow-hidden rounded-lg bg-black/[.04] dark:bg-white/[.06]">
          {details.poster_path ? (
            <Image
              src={`${POSTER_BASE_URL}${details.poster_path}`}
              alt={t.watchlistButton.posterAlt(details.title)}
              fill
              sizes="(min-width: 640px) 220px, 100vw"
              preload
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-center text-sm text-foreground/60">
              {t.common.noPosterAvailable}
            </div>
          )}
          {trailer && (
            <TrailerButton videoKey={trailer.key} title={details.title} locale={locale} />
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
            {` · ${t.detail.seasons(details.number_of_seasons)}`}
            {` · ${t.detail.episodes(details.number_of_episodes)}`}
            {details.genres.length > 0
              ? ` · ${details.genres.map((genre) => genre.name).join(", ")}`
              : ""}
          </p>
          <p className="max-w-2xl text-sm leading-relaxed">
            {details.overview}
          </p>
        </div>
      </div>

      <WatchProviders
        mediaType="tv"
        id={tvId}
        initialRegion={DEFAULT_WATCH_REGION}
        initialData={watchProviders}
      />

      {topCast.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-lg tracking-wide">{t.detail.cast}</h2>
          <CastList cast={topCast} lang={locale} />
        </div>
      )}

      <div className="flex flex-col gap-4">
        <h2 className="font-display text-lg tracking-wide">
          {t.detail.moreLikeThis}
        </h2>
        <MovieGrid
          movies={recommendationsWithRatings}
          basePath="series"
          canExplainMore={isAnthropicAvailable()}
          lang={locale}
        />
      </div>
    </div>
  );
}
