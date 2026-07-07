"use client";

import { useEffect, useRef, useState } from "react";
import type { TMDBMovie } from "@/lib/tmdb";
import { MovieGrid } from "@/components/movie-grid";

const DEBOUNCE_MS = 400;

export function MovieSearch({
  initialMovies,
}: {
  initialMovies: TMDBMovie[];
}) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TMDBMovie[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (trimmedQuery === "") {
      abortRef.current?.abort();
      return;
    }

    const timeout = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/movies/search?query=${encodeURIComponent(trimmedQuery)}`,
          { signal: controller.signal }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to search movies");
        }

        setSearchResults(data.results);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to search movies");
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [trimmedQuery]);

  const movies = trimmedQuery ? (searchResults ?? []) : initialMovies;
  const heading = trimmedQuery ? `Results for "${trimmedQuery}"` : "Popular movies";
  const showLoading = trimmedQuery !== "" && loading;
  const showError = trimmedQuery !== "" ? error : null;

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search movies…"
        aria-label="Search movies"
        className="w-full max-w-md rounded-full border border-black/[.08] bg-transparent px-4 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/[.145]"
      />
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{heading}</h2>
        {showLoading && <span className="text-sm text-foreground/60">Loading…</span>}
      </div>
      {showError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{showError}</p>
      ) : (
        <MovieGrid movies={movies} />
      )}
    </div>
  );
}
