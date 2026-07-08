"use client";

import { useState } from "react";
import type { TMDBGenre, TMDBPerson } from "@/lib/tmdb";
import type { MovieWithRatings } from "@/lib/ratings";
import { MoviesExplorer } from "@/components/movies-explorer";
import { ActorSearch } from "@/components/actor-search";

const TABS = [
  { id: "movies", label: "Movies" },
  { id: "actors", label: "Actors" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function MoviesView({
  initialMovies,
  genres,
  initialPeople,
}: {
  initialMovies: MovieWithRatings[];
  genres: TMDBGenre[];
  initialPeople: TMDBPerson[];
}) {
  const [tab, setTab] = useState<Tab>("movies");

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
                ? "border-b-2 border-accent text-accent"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "movies" ? (
        <MoviesExplorer initialMovies={initialMovies} genres={genres} />
      ) : (
        <ActorSearch initialPeople={initialPeople} />
      )}
    </div>
  );
}
