"use client";

import { useEffect, useRef, useState } from "react";
import type { TMDBPerson } from "@/lib/tmdb";
import { ActorGrid } from "@/components/actor-grid";

const DEBOUNCE_MS = 400;

export function ActorSearch({
  initialPeople,
}: {
  initialPeople: TMDBPerson[];
}) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TMDBPerson[] | null>(
    null
  );
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
          `/api/people/search?query=${encodeURIComponent(trimmedQuery)}`,
          { signal: controller.signal }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to search actors");
        }

        setSearchResults(data.results);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to search actors");
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [trimmedQuery]);

  const people = trimmedQuery ? (searchResults ?? []) : initialPeople;
  const heading = trimmedQuery
    ? `Results for "${trimmedQuery}"`
    : "Trending actors";
  const showLoading = trimmedQuery !== "" && loading;
  const showError = trimmedQuery !== "" ? error : null;

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search actors…"
        aria-label="Search actors"
        className="w-full max-w-md rounded-full border border-black/[.08] bg-transparent px-4 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/[.145]"
      />
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg tracking-wide">{heading}</h2>
        {showLoading && <span className="text-sm text-foreground/60">Loading…</span>}
      </div>
      {showError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{showError}</p>
      ) : (
        <ActorGrid people={people} />
      )}
    </div>
  );
}
