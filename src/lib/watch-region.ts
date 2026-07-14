import { DEFAULT_WATCH_REGION, isWatchRegion, type WatchRegion } from "@/lib/watch-providers";

// Same localStorage pattern as watchlist.ts. Unlike watchlist's array
// value, this stores a single string primitive - no useSyncExternalStore
// snapshot-stability workaround needed (two separately-read "US" strings
// are already `Object.is`-equal), so this stays simpler than watchlist.ts.

const STORAGE_KEY = "kindred:watch-region";
// Distinguishes a region the user genuinely picked from the dropdown from
// one merely suggested/defaulted for them (e.g. the language toggle
// auto-setting BR on first switch to pt-BR - see language-toggle.tsx) - a
// suggestion should never overwrite a real choice, and a real choice
// should never later get silently suggested away.
const EXPLICIT_KEY = "kindred:watch-region-explicit";
const CHANGE_EVENT = "kindred:watch-region-changed";

export function getWatchRegion(): WatchRegion {
  if (typeof window === "undefined") return DEFAULT_WATCH_REGION;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored && isWatchRegion(stored) ? stored : DEFAULT_WATCH_REGION;
}

export function hasExplicitWatchRegion(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(EXPLICIT_KEY) === "true";
}

export function setWatchRegion(region: WatchRegion, options: { explicit?: boolean } = {}) {
  if (typeof window === "undefined") return;
  const { explicit = true } = options;
  window.localStorage.setItem(STORAGE_KEY, region);
  if (explicit) {
    window.localStorage.setItem(EXPLICIT_KEY, "true");
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeToWatchRegion(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
