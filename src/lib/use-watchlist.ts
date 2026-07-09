"use client";

import { useSyncExternalStore } from "react";
import {
  addToWatchlist,
  getWatchlist,
  removeFromWatchlist,
  subscribeToWatchlist,
  type WatchlistItem,
  type WatchlistMediaType,
} from "@/lib/watchlist";

// The server (and the client's first pre-hydration render) can't read
// localStorage - both must agree on an empty list or React flags a
// hydration mismatch. useSyncExternalStore is the built-in primitive for
// exactly this: it forces this snapshot on the first client render, then
// re-syncs to the real value before this component's own effects run - no
// manual mounted-state+useEffect needed (that version hit
// react-hooks/set-state-in-effect, since setting a "mounted" flag
// synchronously in an effect body is what that rule flags).
const SERVER_SNAPSHOT: WatchlistItem[] = [];

export function useWatchlist() {
  const items = useSyncExternalStore(subscribeToWatchlist, getWatchlist, () => SERVER_SNAPSHOT);

  function has(id: number, mediaType: WatchlistMediaType): boolean {
    return items.some((item) => item.id === id && item.mediaType === mediaType);
  }

  return { items, has, add: addToWatchlist, remove: removeFromWatchlist };
}
