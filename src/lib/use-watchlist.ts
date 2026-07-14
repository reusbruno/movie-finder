"use client";

import { useSyncExternalStore } from "react";
import {
  getWatchlistEntries,
  setInWatchlist,
  setWatched,
  subscribeToWatchlist,
  type WatchlistEntry,
  type WatchlistMediaType,
} from "@/lib/watchlist";

// The server (and the client's first pre-hydration render) can't know the
// signed-in user's rows - both must agree on an empty map or React flags a
// hydration mismatch. Same useSyncExternalStore pattern as use-auth.ts.
const SERVER_SNAPSHOT: Map<string, WatchlistEntry> = new Map();

export function useWatchlist() {
  const entries = useSyncExternalStore(
    subscribeToWatchlist,
    getWatchlistEntries,
    () => SERVER_SNAPSHOT
  );

  function get(id: number, mediaType: WatchlistMediaType): WatchlistEntry | undefined {
    return entries.get(`${mediaType}:${id}`);
  }

  function has(id: number, mediaType: WatchlistMediaType): boolean {
    return get(id, mediaType)?.inWatchlist ?? false;
  }

  function getWatchedState(id: number, mediaType: WatchlistMediaType): boolean {
    return get(id, mediaType)?.watched ?? false;
  }

  function getRating(id: number, mediaType: WatchlistMediaType): number | null {
    return get(id, mediaType)?.rating ?? null;
  }

  return {
    has,
    getWatched: getWatchedState,
    getRating,
    add: (id: number, mediaType: WatchlistMediaType) => setInWatchlist(id, mediaType, true),
    remove: (id: number, mediaType: WatchlistMediaType) => setInWatchlist(id, mediaType, false),
    setWatched,
  };
}
