import type { Locale } from "./locale";
import en from "./dictionaries/en";
import ptBR from "./dictionaries/pt-BR";

export type { Dictionary } from "./dictionaries/en";
export * from "./locale";

const dictionaries = {
  en,
  "pt-BR": ptBR,
} as const;

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}
