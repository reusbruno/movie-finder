export type Locale = "en" | "pt-BR";

// Brazil-first audience - new visitors with no persisted preference get
// pt-BR, not en. See language-provider.tsx for how this plays out
// server-side (no cookie/middleware in this app, so this is also the
// unconditional language every SSR'd page renders in before any
// client-side correction).
export const DEFAULT_LOCALE: Locale = "pt-BR";

// TMDB wants "en-US", not bare "en" - pt-BR is already exactly TMDB's own
// language code.
export const TMDB_LANGUAGE: Record<Locale, string> = {
  en: "en-US",
  "pt-BR": "pt-BR",
};

export function isLocale(value: string): value is Locale {
  return value === "en" || value === "pt-BR";
}
