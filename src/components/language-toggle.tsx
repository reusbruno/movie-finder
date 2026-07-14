"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { useWatchRegion } from "@/lib/use-watch-region";
import { hasExplicitWatchRegion } from "@/lib/watch-region";
import type { Locale } from "@/lib/i18n/locale";

// Labels are language names, not translated content - "EN"/"PT-BR" stay the
// same regardless of which one is currently active.
const OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "pt-BR", label: "PT-BR" },
];

// Server-rendered detail/actor pages (/movies/[id], /series/[id],
// /actors/[id]) have no way to learn the client's persisted locale other
// than a ?lang= URL param (no cookies/middleware in this app - see
// movies/[id]/page.tsx). Client-driven pages (/movies, /series,
// /watchlist) read locale from Context instead and don't need it, so this
// pattern narrowly targets only the route shape that does.
const DETAIL_PAGE_PATTERN = /^\/(movies|series|actors)\/\d+/;

// A meta/preference control, same tier as ModeToggle - deliberately quiet
// (no accent fill on the active state) per CLAUDE.md's "gold reserved for
// exactly one primary action" note; the hero's Find/Blend button already
// holds that slot.
export function LanguageToggle() {
  const { locale, setLocale, t } = useLanguage();
  const { setRegion } = useWatchRegion();
  const pathname = usePathname();
  const router = useRouter();

  function handleSelect(next: Locale) {
    setLocale(next);
    // Switching to pt-BR suggests Brazil as the likely region - but only if
    // the user has never explicitly picked a region themselves (the
    // {explicit: false} flag below means this suggestion doesn't count as
    // that, so a later genuine choice always wins and this never fires
    // again after one real pick). One-directional on purpose: switching
    // back to EN does not auto-revert region, matching the spec.
    if (next === "pt-BR" && !hasExplicitWatchRegion()) {
      setRegion("BR", { explicit: false });
    }
    // Context alone updates every client component instantly, but a
    // server-rendered detail page's own content (title/overview/cast/
    // "Cast"/"More like this" etc.) is fixed at render time - re-running it
    // needs a real navigation carrying the new locale in the URL.
    if (DETAIL_PAGE_PATTERN.test(pathname)) {
      router.replace(`${pathname}?lang=${next}`, { scroll: false });
    }
  }

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
            onClick={() => handleSelect(option.value)}
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
