"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import { HeaderSearch } from "@/components/header-search";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/components/language-provider";

export function AppHeader() {
  const pathname = usePathname();
  const { t } = useLanguage();

  // MediaExplorer's mood/blend/filter state lives in plain useState, not the
  // URL - so a same-route Link click (already on /movies, the common case
  // for this bug) is a client-side no-op: no navigation event fires, no
  // remount happens, and whatever mode was active (blend/mood/a filter)
  // just stays on screen even though the click "worked" in the sense that
  // href was already correct. A real full navigation is the only thing
  // guaranteed to reset it, since it remounts MediaExplorer from scratch -
  // forced here only in that one case; every other page still gets the
  // normal fast client-side Link transition, which already lands on a
  // fresh MediaExplorer instance for free (different route = different
  // component mount, no bug there).
  function handleLogoClick(event: MouseEvent<HTMLAnchorElement>) {
    if (pathname === "/movies") {
      event.preventDefault();
      window.location.href = "/movies";
    }
  }

  return (
    <header className="flex items-center justify-between gap-2 border-b border-black/[.08] px-6 py-4 sm:gap-4 dark:border-white/[.145]">
      <Link
        href="/movies"
        onClick={handleLogoClick}
        className="flex items-center gap-2 transition-opacity hover:opacity-80"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" className="h-7 w-7" aria-hidden="true" />
        {/* The wordmark is the first thing to go on narrow screens - the
            logo mark, header search, Watchlist link, and Movies/Series
            toggle don't all fit on one row below ~400px otherwise. */}
        <span className="hidden font-display text-lg tracking-[0.15em] text-accent sm:inline">
          KINDRED
        </span>
      </Link>
      <div className="flex items-center gap-2 sm:gap-4">
        <HeaderSearch />
        <Link
          href="/watchlist"
          className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
        >
          {t.header.watchlist}
        </Link>
        <LanguageToggle />
        <ModeToggle />
      </div>
    </header>
  );
}
