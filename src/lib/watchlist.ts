import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getUser, subscribeToAuth } from "@/lib/auth";

export type WatchlistMediaType = "movie" | "tv";

type Key = `${WatchlistMediaType}:${number}`;

function toKey(id: number, mediaType: WatchlistMediaType): Key {
  return `${mediaType}:${id}`;
}

// in_watchlist/watched/rating are independent per-row states (see
// supabase/migrations/0002_decouple_watched.sql) - a row can exist with
// any combination, e.g. rated+watched but never wishlisted, or wishlisted
// then later removed while keeping its watched/rating history. Holds
// exactly what the row-level UI needs to answer "is this saved / watched /
// what's my rating" without a per-card query - never title/poster/notes,
// which the DB doesn't store either (see the watchlist page's own re-fetch
// of TMDB details).
export interface WatchlistEntry {
  inWatchlist: boolean;
  watched: boolean;
  rating: number | null;
}

// Module-level store, same idiom as auth.ts/watch-region.ts - not
// Context+useState. Fetched once per signed-in user (see loadForUser
// below), not once per card.
let entries: Map<Key, WatchlistEntry> = new Map();
let loadedForUserId: string | null = null;
let initialized = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

interface WatchlistRow {
  tmdb_id: number;
  media_type: WatchlistMediaType;
  in_watchlist: boolean;
  watched: boolean;
  rating: number | null;
}

async function loadForUser(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("watchlist")
    .select("tmdb_id, media_type, in_watchlist, watched, rating")
    .eq("user_id", userId);

  // A signed-out race (user changed again while this was in flight) is
  // handled by the loadedForUserId check on the next auth notification,
  // not here - a failed/late fetch just leaves the previous snapshot in
  // place rather than clearing real data based on stale info.
  if (error) return;

  // Cast rather than `.returns<T>()` - the browser client has no Database
  // schema type (see supabase/client.ts), so the query builder's own
  // generics resolve too loosely for `.returns<T>()` to type-check.
  const rows = (data ?? []) as WatchlistRow[];
  const map = new Map<Key, WatchlistEntry>();
  for (const row of rows) {
    map.set(toKey(row.tmdb_id, row.media_type), {
      inWatchlist: row.in_watchlist,
      watched: row.watched,
      rating: row.rating,
    });
  }
  entries = map;
  loadedForUserId = userId;
  notify();
}

function reactToAuthChange() {
  const user = getUser();
  if (!user) {
    if (entries.size > 0 || loadedForUserId !== null) {
      entries = new Map();
      loadedForUserId = null;
      notify();
    }
    return;
  }
  if (loadedForUserId !== user.id) {
    loadForUser(user.id);
  }
}

function ensureInitialized() {
  if (initialized) return;
  initialized = true;

  // Reacts to auth changes rather than being told about them explicitly -
  // sign-out clears the map immediately (no lingering state visible to
  // the next signed-out view of a shared device); signing in as a new/
  // different user triggers exactly one fetch of that user's own rows.
  subscribeToAuth(reactToAuthChange);
  // subscribeToAuth only registers interest in FUTURE auth notifications -
  // if auth.ts already resolved the session before this module ever
  // initialized, that resolution's notify() already fired to whatever
  // listeners existed at the time, which didn't include this one yet - a
  // subscribe-after-publish miss (hit and fixed once already in this
  // app's history - see the git log for the original fix). Checking the
  // already-resolved state once, immediately, covers that gap.
  reactToAuthChange();
}

export function getWatchlistEntries(): Map<Key, WatchlistEntry> {
  ensureInitialized();
  return entries;
}

export function subscribeToWatchlist(callback: () => void): () => void {
  ensureInitialized();
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export interface WatchlistWriteResult {
  error: "not-signed-in" | "failed" | null;
}

// Toggles wishlist membership only - never touches watched/rating on an
// existing row, and a brand-new row gets watched:false/rating:null from
// the table's own column defaults (matches "add to wishlist" creating a
// fresh, unwatched, unrated entry). Upserts rather than insert/delete:
// removing from the wishlist must NOT delete watched/rating history (see
// setWatched below) - see supabase/migrations/0002_decouple_watched.sql.
export async function setInWatchlist(
  id: number,
  mediaType: WatchlistMediaType,
  inWatchlist: boolean
): Promise<WatchlistWriteResult> {
  const user = getUser();
  if (!user) return { error: "not-signed-in" };

  const key = toKey(id, mediaType);
  const previous = entries.get(key);
  if (previous?.inWatchlist === inWatchlist) return { error: null };

  // Optimistic - the bookmark fills in immediately, rolled back below
  // only if the write actually fails.
  const optimistic = new Map(entries);
  optimistic.set(key, {
    inWatchlist,
    watched: previous?.watched ?? false,
    rating: previous?.rating ?? null,
  });
  entries = optimistic;
  notify();

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("watchlist")
    .upsert(
      { user_id: user.id, tmdb_id: id, media_type: mediaType, in_watchlist: inWatchlist },
      { onConflict: "user_id,tmdb_id,media_type" }
    );

  if (error) {
    const rolledBack = new Map(entries);
    if (previous) rolledBack.set(key, previous);
    else rolledBack.delete(key);
    entries = rolledBack;
    notify();
    return { error: "failed" };
  }
  return { error: null };
}

// Sets watched (+ optional rating) independently of wishlist membership.
// `rating` is optional and tri-state: omitted = leave the existing rating
// untouched (e.g. just toggling watched off), explicit number = set it,
// `null` = clear it. When this creates a brand-new row (marking watched
// on a title that was never touched before), in_watchlist is explicitly
// forced to false in the write - marking watched from the catalog must
// never silently add the title to the wishlist. An EXISTING row's
// in_watchlist is never touched here, at all, so marking watched on an
// already-wishlisted title can't accidentally remove it either.
export async function setWatched(
  id: number,
  mediaType: WatchlistMediaType,
  watched: boolean,
  rating?: number | null
): Promise<WatchlistWriteResult> {
  const user = getUser();
  if (!user) return { error: "not-signed-in" };

  const key = toKey(id, mediaType);
  const previous = entries.get(key);
  const isNewRow = previous === undefined;

  const optimistic = new Map(entries);
  optimistic.set(key, {
    inWatchlist: previous?.inWatchlist ?? false,
    watched,
    rating: rating !== undefined ? rating : (previous?.rating ?? null),
  });
  entries = optimistic;
  notify();

  const payload: {
    user_id: string;
    tmdb_id: number;
    media_type: WatchlistMediaType;
    watched: boolean;
    in_watchlist?: boolean;
    rating?: number | null;
  } = { user_id: user.id, tmdb_id: id, media_type: mediaType, watched };
  if (isNewRow) payload.in_watchlist = false;
  if (rating !== undefined) payload.rating = rating;

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("watchlist")
    .upsert(payload, { onConflict: "user_id,tmdb_id,media_type" });

  if (error) {
    const rolledBack = new Map(entries);
    if (previous) rolledBack.set(key, previous);
    else rolledBack.delete(key);
    entries = rolledBack;
    notify();
    return { error: "failed" };
  }
  return { error: null };
}
