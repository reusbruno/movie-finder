import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getUser, subscribeToAuth } from "@/lib/auth";

export type WatchlistMediaType = "movie" | "tv";

type Key = `${WatchlistMediaType}:${number}`;

function toKey(id: number, mediaType: WatchlistMediaType): Key {
  return `${mediaType}:${id}`;
}

// Module-level store, same idiom as auth.ts/watch-region.ts - not
// Context+useState. Holds membership only (id/mediaType pairs), never the
// full row - the DB doesn't store title/poster either (see
// supabase/migrations/0001_watchlist.sql), so there's nothing richer to
// cache here. The watchlist page itself fetches full TMDB details
// separately (src/app/watchlist/page.tsx) - this store only answers "is
// this title already saved," fetched once per signed-in user rather than
// once per card (see loadForUser below).
let items: Set<Key> = new Set();
let loadedForUserId: string | null = null;
let initialized = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

interface WatchlistIdRow {
  tmdb_id: number;
  media_type: WatchlistMediaType;
}

async function loadForUser(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("watchlist")
    .select("tmdb_id, media_type")
    .eq("user_id", userId);

  // A signed-out race (user changed again while this was in flight) is
  // handled by the loadedForUserId check on the next auth notification,
  // not here - a failed/late fetch just leaves the previous snapshot in
  // place rather than clearing real data based on stale info.
  if (error) return;

  // Cast rather than `.returns<T>()` - the browser client has no Database
  // schema type (see supabase/client.ts), so the query builder's own
  // generics resolve too loosely for `.returns<T>()` to type-check.
  const rows = (data ?? []) as WatchlistIdRow[];
  items = new Set(rows.map((row) => toKey(row.tmdb_id, row.media_type)));
  loadedForUserId = userId;
  notify();
}

function reactToAuthChange() {
  const user = getUser();
  if (!user) {
    if (items.size > 0 || loadedForUserId !== null) {
      items = new Set();
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
  // sign-out clears the set immediately (no lingering "saved" state
  // visible to the next signed-out view of a shared device); signing in
  // as a new/different user triggers exactly one fetch of that user's own
  // id set, matching "fetch once per page load, not once per card."
  subscribeToAuth(reactToAuthChange);
  // subscribeToAuth only registers interest in FUTURE auth notifications -
  // if auth.ts already resolved the session before this module ever
  // initialized (e.g. the header's AuthStatus mounted first and its own
  // useAuth() call triggered auth.ts's session read before any
  // WatchlistButton on the page did), that resolution's notify() already
  // fired to whatever listeners existed at the time, which didn't include
  // this one yet - a classic subscribe-after-publish miss. Confirmed live:
  // without this line, a hard page reload (fresh JS context every time)
  // left the watchlist id-set permanently empty for the rest of that page
  // load, since no FURTHER auth event was ever going to fire to retry it.
  // Checking the already-resolved state once, immediately, covers exactly
  // that gap; if auth hasn't resolved yet at this point, getUser() reads
  // as undefined, the `!user` branch below is a harmless no-op against an
  // already-empty set, and the real resolution's later notify() still
  // fires this same callback correctly when it lands.
  reactToAuthChange();
}

export function getWatchlistIds(): Set<Key> {
  ensureInitialized();
  return items;
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

export async function addToWatchlist(
  id: number,
  mediaType: WatchlistMediaType
): Promise<WatchlistWriteResult> {
  const user = getUser();
  if (!user) return { error: "not-signed-in" };

  const key = toKey(id, mediaType);
  if (items.has(key)) return { error: null };

  // Optimistic - the card's bookmark fills in immediately, rolled back
  // below only if the write actually fails.
  items = new Set(items).add(key);
  notify();

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("watchlist")
    .insert({ user_id: user.id, tmdb_id: id, media_type: mediaType });

  if (error) {
    const rolledBack = new Set(items);
    rolledBack.delete(key);
    items = rolledBack;
    notify();
    return { error: "failed" };
  }
  return { error: null };
}

export async function removeFromWatchlist(
  id: number,
  mediaType: WatchlistMediaType
): Promise<WatchlistWriteResult> {
  const user = getUser();
  if (!user) return { error: "not-signed-in" };

  const key = toKey(id, mediaType);
  const previous = items;
  if (!previous.has(key)) return { error: null };

  const next = new Set(previous);
  next.delete(key);
  items = next;
  notify();

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("watchlist")
    .delete()
    .eq("user_id", user.id)
    .eq("tmdb_id", id)
    .eq("media_type", mediaType);

  if (error) {
    items = previous;
    notify();
    return { error: "failed" };
  }
  return { error: null };
}
