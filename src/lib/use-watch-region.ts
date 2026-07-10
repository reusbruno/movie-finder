"use client";

import { useSyncExternalStore } from "react";
import {
  getWatchRegion,
  setWatchRegion,
  subscribeToWatchRegion,
} from "@/lib/watch-region";
import { DEFAULT_WATCH_REGION } from "@/lib/watch-providers";

// Same rationale as use-watchlist.ts: useSyncExternalStore forces this
// snapshot on the first client render (matching what the server rendered,
// since the server has no access to localStorage), then re-syncs to the
// real persisted region before this component's own effects run.
export function useWatchRegion() {
  const region = useSyncExternalStore(
    subscribeToWatchRegion,
    getWatchRegion,
    () => DEFAULT_WATCH_REGION
  );

  return { region, setRegion: setWatchRegion };
}
