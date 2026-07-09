// First localStorage usage in this app - every read/write here is guarded
// with `typeof window` so this module is safe to import from a component
// that also renders on the server (the check itself, not just wrapping
// call sites, since a bare `window.localStorage` reference would throw
// during SSR even before anything calls these functions).

export type WatchlistMediaType = "movie" | "tv";

export interface WatchlistItem {
  id: number;
  mediaType: WatchlistMediaType;
  title: string;
  posterPath: string | null;
}

const STORAGE_KEY = "kindred:watchlist";
// Fired after every write so any mounted useWatchlist() instance (e.g. two
// cards for the same title in different grids) re-reads and stays in sync,
// without a full page reload. Also lets the hook piggyback on the native
// `storage` event for cross-tab sync at no extra cost.
const CHANGE_EVENT = "kindred:watchlist-changed";

// useWatchlist() reads via useSyncExternalStore, which requires getSnapshot
// to return a referentially stable value when nothing actually changed - if
// every call re-parsed JSON into a fresh array, React would see a "new"
// snapshot on every render and loop forever ("Maximum update depth
// exceeded", hit while verifying this locally). Cache the parsed array
// alongside the raw string it came from, and only re-parse when the raw
// value itself has changed.
let cachedRaw: string | null = null;
let cachedItems: WatchlistItem[] = [];

function readAll(): WatchlistItem[] {
  if (typeof window === "undefined") return cachedItems;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedItems;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedItems = Array.isArray(parsed) ? (parsed as WatchlistItem[]) : [];
  } catch {
    cachedItems = [];
  }
  return cachedItems;
}

function writeAll(items: WatchlistItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function getWatchlist(): WatchlistItem[] {
  return readAll();
}

export function addToWatchlist(item: WatchlistItem) {
  const items = readAll();
  if (items.some((existing) => existing.id === item.id && existing.mediaType === item.mediaType)) {
    return;
  }
  writeAll([...items, item]);
}

export function removeFromWatchlist(id: number, mediaType: WatchlistMediaType) {
  writeAll(readAll().filter((item) => !(item.id === id && item.mediaType === mediaType)));
}

export function subscribeToWatchlist(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
