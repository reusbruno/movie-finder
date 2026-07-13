import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/locale";

// Same localStorage + custom-event pattern as watch-region.ts - a single
// string primitive, no useSyncExternalStore snapshot-stability workaround
// needed (two separately-read "pt-BR" strings are already Object.is-equal).

const STORAGE_KEY = "kindred:locale";
const CHANGE_EVENT = "kindred:locale-changed";

export function getLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored && isLocale(stored) ? stored : DEFAULT_LOCALE;
}

export function setLocale(locale: Locale) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, locale);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeToLocale(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
