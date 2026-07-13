"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import { getLocale, setLocale as persistLocale, subscribeToLocale } from "@/lib/language";

// Same rationale as useWatchRegion: useSyncExternalStore forces this
// snapshot on the first client render (matching what the server rendered,
// since the server has no access to localStorage), then re-syncs to the
// real persisted locale before this component's own effects run - and
// sidesteps react-hooks/set-state-in-effect entirely, the same lint rule
// the watchlist feature hit with a plain useState+useEffect first attempt.
// No Context/Provider needed for cross-component reactivity (e.g. the
// header's LanguageToggle reaching MediaExplorer, a sibling subtree) -
// every useLanguage() call subscribes to the same module-level store in
// language.ts, exactly like useWatchRegion already does.
export function useLanguage(): {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
} {
  const locale = useSyncExternalStore(subscribeToLocale, getLocale, () => DEFAULT_LOCALE);
  return { locale, setLocale: persistLocale, t: getDictionary(locale) };
}

// Mounted once near the root (layout.tsx) - keeps <html lang> in sync with
// the real locale after hydration, since the root layout's lang="en" is a
// static SSR default (same reasoning as DEFAULT_LOCALE above). Safe to
// mutate directly outside React's own diffing for this one attribute, same
// established pattern as e.g. next-themes toggling a dark/light class.
export function LanguageProvider({ children }: { children: ReactNode }) {
  const { locale } = useLanguage();

  useEffect(() => {
    document.documentElement.lang = locale === "pt-BR" ? "pt-BR" : "en";
  }, [locale]);

  return <>{children}</>;
}
