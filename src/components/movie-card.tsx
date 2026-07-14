"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import type { MovieWithMatch } from "@/lib/match-explanation";
import { useWatchlist } from "@/lib/use-watchlist";
import { useAuth } from "@/lib/use-auth";
import type { WatchlistMediaType } from "@/lib/watchlist";
import { ScoreBadges } from "@/components/score-badges";
import { useLanguage } from "@/components/language-provider";

// Exported for reuse on the detail pages' own poster (movies/[id],
// series/[id]) - the design requires a watchlist button there too, not
// just on grid cards, and the add/remove/sign-in-redirect behavior is
// identical either way.
export function WatchlistButton({
  id,
  mediaType,
  title,
}: {
  id: number;
  mediaType: WatchlistMediaType;
  title: string;
}) {
  const { t } = useLanguage();
  const { has, add, remove } = useWatchlist();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const saved = has(id, mediaType);

  function handleClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    // Prompt sign-in rather than failing silently - matches every other
    // "not signed in" path in this feature (the watchlist page itself
    // redirects the same way).
    if (!user) {
      router.push(`/sign-in?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (saved) {
      // The /watchlist page itself is server-rendered from the DB at
      // request time - removing an item there needs a refresh so the now-
      // stale server-rendered card/controls actually disappear, not just
      // show an unfilled bookmark. Every other grid is unaffected by a
      // refresh of its own route, so this is scoped to that one page.
      void remove(id, mediaType).then(() => {
        if (pathname === "/watchlist") router.refresh();
      });
    } else {
      void add(id, mediaType);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={saved}
      aria-label={saved ? t.watchlistButton.removeAria(title) : t.watchlistButton.addAria(title)}
      title={saved ? t.watchlistButton.removeTooltip : t.watchlistButton.addTooltip}
      className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
    >
      <Bookmark className="h-3.5 w-3.5" fill={saved ? "currentColor" : "none"} />
    </button>
  );
}

const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";
// Matches the grid's column breakpoints (grid-cols-3 sm:4 md:6 xl:8) so the
// browser requests a poster sized for how large it's actually rendered,
// instead of always fetching the full w500 source.
const POSTER_SIZES =
  "(min-width: 1280px) 12vw, (min-width: 768px) 16vw, (min-width: 640px) 25vw, 33vw";

export function MovieCard({
  movie,
  basePath = "movies",
  eager = false,
  canExplainMore = false,
  lang,
}: {
  // mediaType is optional and only needed when a single grid mixes movies
  // and TV (the watchlist page) - when present it overrides `basePath` for
  // this card's link and watchlist identity; every other grid is uniformly
  // one media type and relies on `basePath` alone, same as before.
  movie: MovieWithMatch & { mediaType?: WatchlistMediaType };
  basePath?: "movies" | "series";
  eager?: boolean;
  // Whether the on-demand LLM elaboration is available (ANTHROPIC_API_KEY
  // set) - gates the "Explain more" button independent of whether this
  // particular card has a matchExplanation to expand.
  canExplainMore?: boolean;
  // Appended to the card's detail-page link as ?lang= - only set by a
  // server-rendered detail page's "More like this" grid (see
  // movies/[id]/page.tsx), which has no other way to pass its resolved
  // locale to the next server-rendered page a click lands on. Every other
  // caller (the client-driven browse/search/mood/watchlist grids) omits it
  // entirely - those pages don't need it, they read locale from Context.
  lang?: string;
}) {
  const { t } = useLanguage();
  const year = movie.release_date ? movie.release_date.slice(0, 4) : null;
  const mediaType: WatchlistMediaType = movie.mediaType ?? (basePath === "series" ? "tv" : "movie");
  const cardBasePath = movie.mediaType ? (movie.mediaType === "tv" ? "series" : "movies") : basePath;

  const [expanded, setExpanded] = useState<string | null>(null);
  const [expanding, setExpanding] = useState(false);
  const [expandError, setExpandError] = useState<string | null>(null);

  async function handleExplainMore(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!movie.matchExplanation || expanding) return;

    setExpanding(true);
    setExpandError(null);

    try {
      const response = await fetch("/api/explain-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: movie.title,
          explanation: movie.matchExplanation,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? t.explain.failedToExpand);
      }

      setExpanded(data.text);
    } catch (err) {
      setExpandError(err instanceof Error ? err.message : t.explain.failedToExpand);
    } finally {
      setExpanding(false);
    }
  }

  return (
    <Link
      href={lang ? `/${cardBasePath}/${movie.id}?lang=${lang}` : `/${cardBasePath}/${movie.id}`}
      className="group relative block aspect-[2/3] overflow-hidden rounded-lg bg-black/[.04] shadow-none transition-all duration-200 ease-out hover:z-10 hover:scale-[1.04] hover:shadow-lg hover:shadow-black/40 focus-visible:z-10 focus-visible:scale-[1.04] focus-visible:ring-2 focus-visible:ring-accent dark:bg-white/[.06]"
    >
      <WatchlistButton id={movie.id} mediaType={mediaType} title={movie.title} />
      {movie.poster_path ? (
        <Image
          src={`${POSTER_BASE_URL}${movie.poster_path}`}
          alt={t.watchlistButton.posterAlt(movie.title)}
          fill
          sizes={POSTER_SIZES}
          loading={eager ? "eager" : "lazy"}
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm text-foreground/60">
          {t.common.noPosterAvailable}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pt-8 pb-2">
        <h3 className="line-clamp-2 text-base font-medium leading-tight text-white">
          {movie.title}
        </h3>
        <div className="grid grid-rows-[0fr] opacity-0 transition-all duration-200 ease-out group-hover:grid-rows-[1fr] group-hover:opacity-100 group-focus-visible:grid-rows-[1fr] group-focus-visible:opacity-100">
          <div className="overflow-hidden">
            <p className="pt-1 text-xs text-white/70">
              {year ?? t.common.unknownYear}
            </p>
            <p className="text-xs text-white/80">
              <ScoreBadges
                tmdbScore={movie.vote_average}
                imdbRating={movie.ratings.imdbRating}
                rtScore={movie.ratings.rottenTomatoesScore}
              />
            </p>
            {movie.matchExplanation && (
              <div className="mt-1">
                <p className="line-clamp-2 text-[11px] text-white/70">
                  {expanded ?? movie.matchExplanation}
                </p>
                {canExplainMore && !expanded && (
                  <button
                    type="button"
                    onClick={handleExplainMore}
                    disabled={expanding}
                    title={expandError ?? undefined}
                    className="text-[10px] text-white/50 underline hover:text-white/80 disabled:no-underline disabled:opacity-60"
                  >
                    {expanding ? t.explain.expanding : expandError ? t.common.tryAgain : t.explain.explainMore}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
