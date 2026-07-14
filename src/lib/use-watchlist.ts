"use client";

import { useSyncExternalStore } from "react";
import {
  addToWatchlist,
  getWatchlistIds,
  removeFromWatchlist,
  subscribeToWatchlist,
  type WatchlistMediaType,
} from "@/lib/watchlist";

// The server (and the client's first pre-hydration render) can't know the
// signed-in user's saved ids - both must agree on an empty set or React
// flags a hydration mismatch. Same useSyncExternalStore pattern as
// use-auth.ts.
const SERVER_SNAPSHOT: Set<string> = new Set();

export function useWatchlist() {
  const ids = useSyncExternalStore(subscribeToWatchlist, getWatchlistIds, () => SERVER_SNAPSHOT);

  function has(id: number, mediaType: WatchlistMediaType): boolean {
    return ids.has(`${mediaType}:${id}`);
  }

  return { has, add: addToWatchlist, remove: removeFromWatchlist };
}
