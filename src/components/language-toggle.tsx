"use client";

import { useLanguage } from "@/components/language-provider";
import type { Locale } from "@/lib/i18n/locale";

// Labels are language names, not translated content - "EN"/"PT-BR" stay the
// same regardless of which one is currently active.
const OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "pt-BR", label: "PT-BR" },
];

// A meta/preference control, same tier as ModeToggle - deliberately quiet
// (no accent fill on the active state) per CLAUDE.md's "gold reserved for
// exactly one primary action" note; the hero's Find/Blend button already
// holds that slot.
export function LanguageToggle() {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div
      role="group"
      aria-label={t.header.languageAriaLabel}
      className="inline-flex rounded-full border border-black/[.08] p-1 dark:border-white/[.145]"
    >
      {OPTIONS.map((option) => {
        const active = locale === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setLocale(option.value)}
            aria-pressed={active}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "bg-black/[.06] text-foreground dark:bg-white/[.1]"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
