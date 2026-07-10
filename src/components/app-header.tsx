import Link from "next/link";
import { ModeToggle } from "@/components/mode-toggle";
import { HeaderSearch } from "@/components/header-search";

export function AppHeader() {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-black/[.08] px-6 py-4 sm:gap-4 dark:border-white/[.145]">
      <Link
        href="/movies"
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
          Watchlist
        </Link>
        <ModeToggle />
      </div>
    </header>
  );
}
