import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  getMovieDetails,
  getTVDetails,
  type TMDBMovie,
  type TMDBMovieDetails,
  type TMDBTVDetails,
} from "@/lib/tmdb";
import { getMovieRatings, getTVRatings } from "@/lib/ratings";
import type { WatchlistMediaType } from "@/lib/watchlist";
import { MovieGrid } from "@/components/movie-grid";
import { WatchlistItemControls } from "@/components/watchlist-item-controls";
import { isLocale, DEFAULT_LOCALE, TMDB_LANGUAGE } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n";

// The watchlist table only stores tmdb_id/media_type/watched/rating/notes
// (see supabase/migrations/0001_watchlist.sql) - title/poster/current
// ratings are re-fetched fresh from TMDB on every load, same as the old
// localStorage-backed /api/watchlist/enrich route this page replaces,
// rather than trusting a stale snapshot from whenever the title was added.
function toCardShape(details: TMDBMovieDetails | TMDBTVDetails): TMDBMovie {
  return {
    id: details.id,
    title: details.title,
    original_title: details.original_title,
    overview: details.overview,
    release_date: details.release_date,
    poster_path: details.poster_path,
    backdrop_path: details.backdrop_path,
    vote_average: details.vote_average,
    vote_count: details.vote_count,
    popularity: details.popularity,
    genre_ids: details.genres.map((genre) => genre.id),
    original_language: details.original_language,
    adult: details.adult,
  };
}

interface WatchlistRow {
  tmdb_id: number;
  media_type: WatchlistMediaType;
  watched: boolean;
  rating: number | null;
  notes: string | null;
}

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const locale = lang && isLocale(lang) ? lang : DEFAULT_LOCALE;
  const language = TMDB_LANGUAGE[locale];
  const t = getDictionary(locale);

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed out - no anonymous watchlist path (see movie-card.tsx's
  // WatchlistButton, which prompts the same sign-in redirect on click).
  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent("/watchlist")}`);
  }

  // Only the active to-watch list - watched/rating now persist
  // independently of wishlist membership (see
  // supabase/migrations/0002_decouple_watched.sql), so a row can exist
  // here with watched:true/rating:set from before it was ever wishlisted,
  // or survive after being removed from the wishlist - neither belongs on
  // this page, which is specifically "what's still in my wishlist."
  const { data: rawRows, error: queryError } = await supabase
    .from("watchlist")
    .select("tmdb_id, media_type, watched, rating, notes")
    .eq("user_id", user.id)
    .eq("in_watchlist", true)
    .order("added_at", { ascending: false });

  // Cast rather than `.returns<T>()` - the server client has no Database
  // schema type (see supabase/server.ts), so the query builder's own
  // generics resolve too loosely for `.returns<T>()` to type-check.
  const rows = (rawRows ?? []) as WatchlistRow[];

  const enriched = queryError
    ? []
    : await Promise.all(
        rows.map(async (row) => {
          try {
            const [details, ratings] =
              row.media_type === "movie"
                ? await Promise.all([
                    getMovieDetails(row.tmdb_id, language),
                    getMovieRatings(row.tmdb_id),
                  ])
                : await Promise.all([
                    getTVDetails(row.tmdb_id, language),
                    getTVRatings(row.tmdb_id),
                  ]);
            return {
              ...toCardShape(details),
              ratings,
              mediaType: row.media_type,
              // watched/rating are no longer passed as initial props - the
              // card (MovieGrid -> MovieCard -> WatchedButton, same as
              // every other grid) and WatchlistItemControls' rating stars
              // both read them live from the shared client-side watchlist
              // store instead, so there's only one source of truth for
              // either value on this page (see watchlist-item-controls.tsx).
              notes: row.notes,
            };
          } catch {
            // A title that 404s (removed from TMDB, or a stale id) just
            // drops out of the page - shows whatever still resolves
            // rather than erroring the whole thing.
            return null;
          }
        })
      );

  const items = enriched.filter((item) => item !== null);
  const isEmpty = items.length === 0;

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8">
      <h1 className="font-display text-xl tracking-wide">{t.header.watchlist}</h1>
      {queryError ? (
        <p className="py-16 text-center text-foreground/60">{t.watchlist.loadError}</p>
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-foreground/60">{t.watchlist.empty}</p>
          <Link
            href="/movies"
            className="rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium transition-colors hover:border-foreground/30 hover:text-foreground dark:border-white/[.145]"
          >
            {t.watchlist.browseLink}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <MovieGrid movies={items} eagerFirstRow />
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <WatchlistItemControls
                key={`${item.mediaType}:${item.id}`}
                id={item.id}
                mediaType={item.mediaType}
                title={item.title}
                initialNotes={item.notes}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
