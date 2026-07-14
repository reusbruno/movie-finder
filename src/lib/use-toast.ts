"use client";

import { useSyncExternalStore } from "react";
import { getToast, subscribeToToast, type ToastState } from "@/lib/toast";

// Server (and the client's first pre-hydration render) never has a toast
// showing - both must agree on `null` or React flags a hydration
// mismatch. Same useSyncExternalStore pattern as this app's other stores.
const SERVER_SNAPSHOT: ToastState | null = null;

export function useToast(): ToastState | null {
  return useSyncExternalStore(subscribeToToast, getToast, () => SERVER_SNAPSHOT);
}
