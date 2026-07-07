"use client";

import { useState } from "react";
import type { TMDBGenre, TMDBMovie } from "@/lib/tmdb";
import { MovieSearch } from "@/components/movie-search";
import { MovieBrowse } from "@/components/movie-browse";

const TABS = [
  { id: "search", label: "Search" },
  { id: "browse", label: "Browse" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function MoviesView({
  initialMovies,
  genres,
}: {
  initialMovies: TMDBMovie[];
  genres: TMDBGenre[];
}) {
  const [tab, setTab] = useState<Tab>("search");

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex gap-2 border-b border-black/[.08] px-6 pt-4 dark:border-white/[.145]">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
            className={`rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === id
                ? "border-b-2 border-foreground text-foreground"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "search" ? (
        <MovieSearch initialMovies={initialMovies} />
      ) : (
        <MovieBrowse genres={genres} />
      )}
    </div>
  );
}
