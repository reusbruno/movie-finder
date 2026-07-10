"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { TMDBMovie } from "@/lib/tmdb";

const DEBOUNCE_MS = 400;

// Compact quick-lookup for power users who just want a specific title,
// without going through the hero. Fully self-contained (own fetch, own
// state) - clicking a result or pressing Enter navigates straight to the
// title's detail page, it never touches MediaExplorer's search/filter
// state. Same debounce/abort/request-id shape as TitlePicker, but
// navigates instead of selecting into a controlled value.
export function HeaderSearch() {
  const pathname = usePathname();
  const router = useRouter();
  const basePath = pathname?.startsWith("/series") ? "series" : "movies";
  const searchEndpoint = basePath === "series" ? "/api/tv/search" : "/api/movies/search";

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const trimmedQuery = query.trim();

  function reset() {
    setOpen(false);
    setQuery("");
    setResults([]);
  }

  function goToTitle(id: number) {
    router.push(`/${basePath}/${id}`);
    reset();
  }

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (trimmedQuery === "") {
      // No setResults() here, same as TitlePicker - the dropdown only
      // renders when trimmedQuery is non-empty, so stale results are
      // simply never shown.
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
        reset();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search titles"
        className="text-foreground/60 transition-colors hover:text-foreground"
      >
        <Search className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            reset();
          } else if (event.key === "Enter" && results[0]) {
            goToTitle(results[0].id);
          }
        }}
        placeholder="Search titles…"
        aria-label="Search titles"
        className="w-48 rounded-full border border-black/[.08] bg-transparent px-3 py-1.5 text-sm outline-none focus:border-foreground/40 dark:border-white/[.145]"
      />
      {trimmedQuery !== "" && (
        <div className="absolute right-0 z-10 mt-1 w-64 overflow-hidden rounded-md border border-black/[.08] bg-background shadow-lg dark:border-white/[.145]">
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
                    onClick={() => goToTitle(result.id)}
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
