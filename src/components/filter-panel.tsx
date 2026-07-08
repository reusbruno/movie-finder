"use client";

import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";

export function FilterPanel({
  activeCount,
  children,
}: {
  activeCount: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-colors ${
          open
            ? "border-foreground/30 bg-black/[.04] text-foreground dark:bg-white/[.06]"
            : "border-black/[.08] text-foreground/50 hover:text-foreground/80 dark:border-white/[.145]"
        }`}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        Filters
        {activeCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-semibold text-accent-foreground">
            {activeCount}
          </span>
        )}
      </button>
      {/* basis-full forces this onto its own full-width line within the
          parent's flex-wrap row, directly below the search+toggle row -
          not a sibling column beside them (the bug this replaces). */}
      <div
        className={`grid w-full basis-full transition-all duration-200 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-4 rounded-lg border border-black/[.06] bg-black/[.02] p-4 dark:border-white/[.08] dark:bg-white/[.03]">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
