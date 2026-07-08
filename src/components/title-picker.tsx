"use client";

import { useEffect, useRef, useState } from "react";
import type { TMDBMovie } from "@/lib/tmdb";

const DEBOUNCE_MS = 400;

export interface PickedTitle {
  id: number;
  title: string;
}

// Compact single-title picker: debounced search -> dropdown of matches ->
// pick one. Same debounce/abort/request-id pattern as ActorSearch and
// MediaExplorer's quick search, adapted into a combobox instead of a
// grid-filtering input since callers need exactly one selected title.
export function TitlePicker({
  searchEndpoint,
  placeholder,
  selected,
  onSelect,
  onClear,
}: {
  searchEndpoint: string;
  placeholder: string;
  selected: PickedTitle | null;
  onSelect: (title: PickedTitle) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (trimmedQuery === "") {
      // No setResults() here - the dropdown only renders when trimmedQuery
      // is non-empty, so stale results are simply never shown.
      abortRef.current?.abort();
      requestIdRef.current += 1;
      return;
    }

    const timeout = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++requestIdRef.current;

      setLoading(true);

      try {
        const response = await fetch(
          `${searchEndpoint}?query=${encodeURIComponent(trimmedQuery)}`,
          { signal: controller.signal }
        );
        const data = await response.json();

        if (requestId !== requestIdRef.current) return;
        if (!response.ok) throw new Error(data.error ?? "Search failed");

        setResults((data.results ?? []).slice(0, 8));
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResults([]);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [trimmedQuery, searchEndpoint]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (selected) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-black/[.08] bg-foreground/5 px-3 py-1.5 text-sm dark:border-white/[.145]">
        {selected.title}
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear ${selected.title}`}
          className="text-foreground/50 hover:text-foreground"
        >
          ×
        </button>
      </span>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <input
        type="text"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-full border border-black/[.08] bg-transparent px-4 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/[.145]"
      />
      {open && trimmedQuery !== "" && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-black/[.08] bg-background shadow-lg dark:border-white/[.145]">
          {loading ? (
            <p className="px-3 py-2 text-xs text-foreground/50">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-foreground/50">No matches</p>
          ) : (
            <ul>
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect({ id: result.id, title: result.title });
                      setQuery("");
                      setOpen(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-foreground/5"
                  >
                    {result.title}
                    {result.release_date && (
                      <span className="ml-2 text-xs text-foreground/50">
                        {result.release_date.slice(0, 4)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
