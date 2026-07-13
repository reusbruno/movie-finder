"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { TMDBMovie, TMDBPerson } from "@/lib/tmdb";
import { useLanguage } from "@/components/language-provider";

const DEBOUNCE_MS = 400;
const MAX_TITLE_RESULTS = 8;
// People are a secondary lookup here (see the Actors-tab removal this
// folded into) - a shorter cap keeps the dropdown from being dominated by
// cast members when the title list is already long.
const MAX_PEOPLE_RESULTS = 4;

// Compact quick-lookup for power users who just want a specific title (or,
// now, a specific person), without going through the hero. Fully
// self-contained (own fetch, own state) - clicking a result or pressing
// Enter navigates straight to the detail page, it never touches
// MediaExplorer's search/filter state. Same debounce/abort/request-id
// shape as TitlePicker, but navigates instead of selecting into a
// controlled value.
export function HeaderSearch() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const basePath = pathname?.startsWith("/series") ? "series" : "movies";
  const searchEndpoint = basePath === "series" ? "/api/tv/search" : "/api/movies/search";

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [titleResults, setTitleResults] = useState<TMDBMovie[]>([]);
  const [peopleResults, setPeopleResults] = useState<TMDBPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const trimmedQuery = query.trim();

  function reset() {
    setOpen(false);
    setQuery("");
    setTitleResults([]);
    setPeopleResults([]);
  }

  function goToTitle(id: number) {
    router.push(`/${basePath}/${id}`);
    reset();
  }

  function goToPerson(id: number) {
    router.push(`/actors/${id}`);
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

      // Promise.allSettled, not Promise.all - people search is a secondary,
      // best-effort addition here; a failure there shouldn't blank out
      // title results that already succeeded, or vice versa.
      const [titleSettled, peopleSettled] = await Promise.allSettled([
        fetch(`${searchEndpoint}?query=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal,
        }).then((response) => response.json()),
        fetch(`/api/people/search?query=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal,
        }).then((response) => response.json()),
      ]);

      if (requestId !== requestIdRef.current) return;

      setTitleResults(
        titleSettled.status === "fulfilled"
          ? (titleSettled.value.results ?? []).slice(0, MAX_TITLE_RESULTS)
          : []
      );
      setPeopleResults(
        peopleSettled.status === "fulfilled"
          ? (peopleSettled.value.results ?? []).slice(0, MAX_PEOPLE_RESULTS)
          : []
      );
      setLoading(false);
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
        aria-label={t.header.searchTitlesAndPeople}
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
          } else if (event.key === "Enter") {
            // Titles are still the primary case (see the component-level
            // comment) - Enter goes to the top title match if there is one,
            // falling back to the top person only when a query matches a
            // name but no title at all (e.g. a pure actor-name lookup).
            if (titleResults[0]) {
              goToTitle(titleResults[0].id);
            } else if (peopleResults[0]) {
              goToPerson(peopleResults[0].id);
            }
          }
        }}
        placeholder={t.header.searchTitlesPlaceholder}
        aria-label={t.header.searchTitlesAndPeople}
        className="w-48 rounded-full border border-black/[.08] bg-transparent px-3 py-1.5 text-sm outline-none focus:border-foreground/40 dark:border-white/[.145]"
      />
      {/* Anchored to the input's left edge on narrow viewports - right-0
          alone overflows off-screen there, since the collapsed mobile
          header (wordmark hidden) sits the input close to the left edge
          with a fixed w-64 dropdown extending further left than that. sm
          and up reverts to right-0, matching the wider desktop header
          where the search icon sits close to the right edge instead. */}
      {trimmedQuery !== "" && (
        <div className="absolute left-0 z-10 mt-1 max-h-96 w-64 overflow-y-auto rounded-md border border-black/[.08] bg-background shadow-lg sm:left-auto sm:right-0 dark:border-white/[.145]">
          {loading ? (
            <p className="px-3 py-2 text-xs text-foreground/50">{t.common.searching}</p>
          ) : titleResults.length === 0 && peopleResults.length === 0 ? (
            <p className="px-3 py-2 text-xs text-foreground/50">{t.common.noMatches}</p>
          ) : (
            <>
              {titleResults.length > 0 && (
                <ul>
                  {titleResults.map((result) => (
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
              {peopleResults.length > 0 && (
                <div
                  className={
                    titleResults.length > 0
                      ? "border-t border-black/[.08] dark:border-white/[.145]"
                      : undefined
                  }
                >
                  <p className="px-3 pt-2 text-xs font-medium tracking-wide text-foreground/50 uppercase">
                    {t.header.people}
                  </p>
                  <ul>
                    {peopleResults.map((person) => (
                      <li key={person.id}>
                        <button
                          type="button"
                          onClick={() => goToPerson(person.id)}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-foreground/5"
                        >
                          {person.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
