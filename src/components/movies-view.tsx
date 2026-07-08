"use client";

import { useState } from "react";
import type { TMDBGenre, TMDBPerson, MovieSortBy } from "@/lib/tmdb";
import type { MovieWithRatings } from "@/lib/ratings";
import { MediaExplorer, type MediaExplorerConfig } from "@/components/media-explorer";
import { ActorSearch } from "@/components/actor-search";

const TABS = [
  { id: "movies", label: "Movies" },
  { id: "actors", label: "Actors" },
] as const;

type Tab = (typeof TABS)[number]["id"];

const MOVIES_CONFIG: MediaExplorerConfig<MovieSortBy> = {
  basePath: "movies",
  searchEndpoint: "/api/movies/search",
  discoverEndpoint: "/api/movies/discover",
  moodSearchEndpoint: "/api/movies/mood-search",
  vibeBlendEndpoint: "/api/movies/vibe-blend",
  searchPlaceholder: "Search movies…",
  sortOptions: [
    { value: "popularity.desc", label: "Popularity" },
    { value: "vote_average.desc", label: "Top Rated" },
    { value: "primary_release_date.desc", label: "Newest" },
    { value: "title.asc", label: "Title (A-Z)" },
  ],
  defaultSort: "popularity.desc",
  popularHeading: "Popular movies",
  itemsLabel: "movies",
};

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
        <MediaExplorer
          initialItems={initialMovies}
          genres={genres}
          config={MOVIES_CONFIG}
        />
      ) : (
        <ActorSearch initialPeople={initialPeople} />
      )}
    </div>
  );
}
