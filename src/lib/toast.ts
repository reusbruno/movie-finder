// Module-level store, same idiom as auth.ts/watchlist.ts/watch-region.ts -
// not Context+useState. Simpler than those: pure in-memory state, no
// localStorage/network read to lazily kick off, so there's no
// ensureInitialized() dance here - just a single current-toast slot,
// pub-sub'd to whatever's subscribed (in practice, exactly one
// ToastContainer mounted once in the root layout).
export type ToastVariant = "success" | "error";

export interface ToastState {
  id: number;
  message: string;
  variant: ToastVariant;
}

const DISMISS_MS = 2500;

let current: ToastState | null = null;
let nextId = 0;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

// A new toast always REPLACES whatever's showing (and restarts the
// dismiss clock) rather than queuing - simpler to implement correctly
// than a queue, and correct for this app's actual usage: rapid add/remove
// clicks across several cards should read as "here's the latest thing
// that happened," not a pile of stacked messages fighting for attention.
export function showToast(message: string, variant: ToastVariant = "success") {
  if (dismissTimer) clearTimeout(dismissTimer);
  current = { id: nextId++, message, variant };
  notify();
  dismissTimer = setTimeout(() => {
    current = null;
    dismissTimer = null;
    notify();
  }, DISMISS_MS);
}

export function dismissToast() {
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  current = null;
  notify();
}

export function getToast(): ToastState | null {
  return current;
}

export function subscribeToToast(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
