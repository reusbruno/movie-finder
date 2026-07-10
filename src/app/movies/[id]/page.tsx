import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getMovieCredits,
  getMovieDetails,
  getMovieRecommendations,
  TMDBError,
} from "@/lib/tmdb";
import { enrichMoviesWithRatings, getMovieRatings } from "@/lib/ratings";
import { getMovieKeywordList } from "@/lib/keywords";
import { DEFAULT_WATCH_REGION, getMovieWatchProviders } from "@/lib/watch-providers";
import { attachMatchExplanations, explainSingleRefMatch } from "@/lib/match-explanation";
import { isAnthropicAvailable } from "@/lib/anthropic-client";
import { MovieGrid } from "@/components/movie-grid";
import { ScoreBadges } from "@/components/score-badges";
import { CastList } from "@/components/cast-list";
import { WatchProviders } from "@/components/watch-providers";

const MAX_CAST_MEMBERS = 12;
// Caps how many "More like this" recommendations get rating-enriched.
// TMDB returns up to 20 per page, and each one costs a TMDB external_ids call
// plus an OMDb (and possibly MDBList fallback) call - uncapped, a single page
// load could trigger ~20 OMDb calls. 8 matches the widest grid breakpoint
// (grid-cols-8 in movie-grid.tsx), so it's still a full row, not a partial one.
const MAX_ENRICHED_RECOMMENDATIONS = 8;

const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";

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

  // Started immediately, alongside getMovieDetails below - none of these
  // three depend on the details response. getMovieRatings (not a direct
  // OMDb call) so this page's own rating shares ratings.ts's cache with
  // every grid/mood-search/blend enrichment - a movie already looked up
  // elsewhere in the last 24h costs nothing here instead of re-spending
  // OMDb quota on every detail-page visit.
  const recommendationsPromise = getMovieRecommendations(movieId);
  const ratingsPromise = getMovieRatings(movieId);
  const creditsPromise = getMovieCredits(movieId);
  // This title's own keywords, for "why this match" on the recommendations
  // below - shares the same cache blend/mood search use, so a title looked
  // up elsewhere costs nothing here.
  const ownKeywordsPromise = getMovieKeywordList(movieId);
  // Server always fetches the default region (US) - it has no access to
  // whatever region the visitor previously picked in localStorage; the
  // client-side WatchProviders component notices the mismatch on mount and
  // re-fetches for the real persisted region if it differs.
  const watchProvidersPromise = getMovieWatchProviders(movieId, DEFAULT_WATCH_REGION);
  // A bad id 404s on every endpoint, not just getMovieDetails - if these
  // reject while getMovieDetails is still in flight below, nothing has
  // observed them yet, which Node treats as an unhandled rejection. The
  // real error is still observed via Promise.all further down; this just
  // pre-empts the false "unhandled" report if the details 404 wins first.
  recommendationsPromise.catch(() => {});
  ratingsPromise.catch(() => {});
  creditsPromise.catch(() => {});
  ownKeywordsPromise.catch(() => {});
  watchProvidersPromise.catch(() => {});

  let details;
  try {
    details = await getMovieDetails(movieId);
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
    "movie",
    genreNames,
    keywordNames,
    (signals) => explainSingleRefMatch(signals, details.title)
  );
  const recommendationsWithRatings = await enrichMoviesWithRatings(
    recommendationsWithExplanations
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

      <WatchProviders
        mediaType="movie"
        id={movieId}
        initialRegion={DEFAULT_WATCH_REGION}
        initialData={watchProviders}
      />

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
          canExplainMore={isAnthropicAvailable()}
        />
      </div>
    </div>
  );
}
