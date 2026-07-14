"use client";

import { useSyncExternalStore } from "react";
import { getUser, subscribeToAuth } from "@/lib/auth";

// Server (and the client's first pre-hydration render) can't know the
// signed-in user - both must agree on the same snapshot or React flags a
// hydration mismatch. useSyncExternalStore forces `undefined` (not yet
// resolved) on the first client render, then re-syncs to the real value
// once the session read in auth.ts settles - same pattern as
// use-watchlist.ts/language-provider.tsx.
const SERVER_SNAPSHOT = undefined;

export function useAuth() {
  const user = useSyncExternalStore(subscribeToAuth, getUser, () => SERVER_SNAPSHOT);

  return {
    user: user ?? null,
    // Distinct from "signed out" (user === null after resolving) - lets
    // callers avoid flashing a "Sign in" link for a split second before
    // the real session is known.
    loading: user === undefined,
  };
}
