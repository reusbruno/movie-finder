"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { TMDB_MAX_DISCOVER_PAGE, type TMDBGenre } from "@/lib/tmdb";
import type { MovieWithRatings } from "@/lib/ratings";
import { MovieGrid } from "@/components/movie-grid";
import { GenreFilter } from "@/components/genre-filter";
import { FilterPanel } from "@/components/filter-panel";

const SEARCH_DEBOUNCE_MS = 400;
const MIN_IMDB_OPTIONS = ["", "6", "7", "8", "9"] as const;
const MIN_RT_OPTIONS = ["", "25", "50", "75", "90"] as const;

export interface MediaExplorerConfig<TSortBy extends string> {
  basePath: "movies" | "series";
  searchEndpoint: string;
  discoverEndpoint: string;
  searchPlaceholder: string;
  sortOptions: { value: TSortBy; label: string }[];
  defaultSort: TSortBy;
  popularHeading: string;
  // Used to build error messages, e.g. "Failed to search movies" / "Failed to load TV shows".
  itemsLabel: string;
  // Optional extra note rendered below the filter controls (e.g. series' RT-score caveat).
  filterFootnote?: ReactNode;
}

export function MediaExplorer<TSortBy extends string>({
  initialItems,
  genres,
  config,
}: {
  initialItems: MovieWithRatings[];
  genres: TMDBGenre[];
  config: MediaExplorerConfig<TSortBy>;
}) {
  const {
    basePath,
    searchEndpoint,
    discoverEndpoint,
    searchPlaceholder,
    sortOptions,
    defaultSort,
    popularHeading,
    itemsLabel,
    filterFootnote,
  } = config;

  const [query, setQuery] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<TSortBy>(defaultSort);
  const [minImdb, setMinImdb] = useState("");
  const [minRt, setMinRt] = useState("");

  const [searchResults, setSearchResults] = useState<MovieWithRatings[] | null>(
    null
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  // Guards against a stale (superseded but not-yet-settled) request
  // applying its result/loading state after a newer request has started -
  // abort() alone doesn't prevent an in-flight request's `finally` from
  // still running after it's been superseded.
  const searchRequestIdRef = useRef(0);

  const [discoverResults, setDiscoverResults] = useState<
    MovieWithRatings[] | null
  >(null);
  const [discoverPage, setDiscoverPage] = useState(1);
  const [discoverTotalPages, setDiscoverTotalPages] = useState(1);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverLoadingMore, setDiscoverLoadingMore] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const discoverAbortRef = useRef<AbortController | null>(null);
  const discoverRequestIdRef = useRef(0);

  const trimmedQuery = query.trim();
  const filtersActive =
    sortBy !== defaultSort ||
    selectedGenres.length > 0 ||
    minImdb !== "" ||
    minRt !== "";

  const mode: "search" | "discover" | "popular" =
    trimmedQuery !== "" ? "search" : filtersActive ? "discover" : "popular";

  function toggleGenre(id: number) {
    setSelectedGenres((prev) =>
      prev.includes(id) ? prev.filter((genreId) => genreId !== id) : [...prev, id]
    );
  }

  function buildDiscoverParams(targetPage: number) {
    const params = new URLSearchParams({ sort_by: sortBy, page: String(targetPage) });
    if (selectedGenres.length > 0) {
      params.set("genres", selectedGenres.join(","));
    }
    if (minImdb) {
      params.set("min_imdb", minImdb);
    }
    if (minRt) {
      params.set("min_rt", minRt);
    }
    return params;
  }

  // A typed query always takes priority - fetch search results regardless
  // of filter state (filters only apply once the query is cleared).
  useEffect(() => {
    if (trimmedQuery === "") {
      searchAbortRef.current?.abort();
      searchRequestIdRef.current += 1;
      return;
    }

    const timeout = setTimeout(async () => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      const requestId = ++searchRequestIdRef.current;

      setSearchLoading(true);
      setSearchError(null);

      try {
        const response = await fetch(
          `${searchEndpoint}?query=${encodeURIComponent(trimmedQuery)}`,
          { signal: controller.signal }
        );
        const data = await response.json();

        if (requestId !== searchRequestIdRef.current) return;

        if (!response.ok) {
          throw new Error(data.error ?? `Failed to search ${itemsLabel}`);
        }

        setSearchResults(data.results);
      } catch (err) {
        if (requestId !== searchRequestIdRef.current) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSearchError(
          err instanceof Error ? err.message : `Failed to search ${itemsLabel}`
        );
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setSearchLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [trimmedQuery, searchEndpoint, itemsLabel]);

  // Only runs when there's no query and at least one filter differs from
  // its default - otherwise the static Popular grid is shown, no fetch.
  useEffect(() => {
    if (trimmedQuery !== "" || !filtersActive) {
      discoverAbortRef.current?.abort();
      discoverRequestIdRef.current += 1;
      return;
    }

    const timeout = setTimeout(async () => {
      discoverAbortRef.current?.abort();
      const controller = new AbortController();
      discoverAbortRef.current = controller;
      const requestId = ++discoverRequestIdRef.current;

      setDiscoverLoading(true);
      setDiscoverError(null);

      try {
        const params = buildDiscoverParams(1);

        const response = await fetch(`${discoverEndpoint}?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await response.json();

        if (requestId !== discoverRequestIdRef.current) return;

        if (!response.ok) {
          throw new Error(data.error ?? `Failed to load ${itemsLabel}`);
        }

        setDiscoverResults(data.results);
        setDiscoverPage(1);
        setDiscoverTotalPages(data.total_pages);
      } catch (err) {
        if (requestId !== discoverRequestIdRef.current) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setDiscoverError(
          err instanceof Error ? err.message : `Failed to load ${itemsLabel}`
        );
      } finally {
        if (requestId === discoverRequestIdRef.current) {
          setDiscoverLoading(false);
        }
      }
    }, 0);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedQuery, selectedGenres, sortBy, minImdb, minRt, discoverEndpoint, itemsLabel]);

  async function loadMoreDiscover() {
    discoverAbortRef.current?.abort();
    const controller = new AbortController();
    discoverAbortRef.current = controller;
    const requestId = ++discoverRequestIdRef.current;

    const nextPage = discoverPage + 1;

    setDiscoverLoadingMore(true);
    setDiscoverError(null);

    try {
      const params = buildDiscoverParams(nextPage);

      const response = await fetch(`${discoverEndpoint}?${params.toString()}`, {
        signal: controller.signal,
      });
      const data = await response.json();

      if (requestId !== discoverRequestIdRef.current) return;

      if (!response.ok) {
        throw new Error(data.error ?? `Failed to load ${itemsLabel}`);
      }

      setDiscoverResults((prev) => [...(prev ?? []), ...data.results]);
      setDiscoverPage(nextPage);
      setDiscoverTotalPages(data.total_pages);
    } catch (err) {
      if (requestId !== discoverRequestIdRef.current) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      setDiscoverError(
        err instanceof Error ? err.message : `Failed to load ${itemsLabel}`
      );
    } finally {
      if (requestId === discoverRequestIdRef.current) {
        setDiscoverLoadingMore(false);
      }
    }
  }

  const items =
    mode === "search"
      ? (searchResults ?? [])
      : mode === "discover"
        ? (discoverResults ?? [])
        : initialItems;

  const heading =
    mode === "search"
      ? `Results for "${trimmedQuery}"`
      : mode === "discover"
        ? "Filtered results"
        : popularHeading;

  const loading = mode === "search" ? searchLoading : mode === "discover" ? discoverLoading : false;
  const error = mode === "search" ? searchError : mode === "discover" ? discoverError : null;
  const canLoadMore =
    mode === "discover" &&
    discoverPage < discoverTotalPages &&
    discoverPage < TMDB_MAX_DISCOVER_PAGE;

  const activeFilterCount =
    (selectedGenres.length > 0 ? 1 : 0) +
    (sortBy !== defaultSort ? 1 : 0) +
    (minImdb ? 1 : 0) +
    (minRt ? 1 : 0);

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder.replace("…", "")}
          className="w-full max-w-md rounded-full border border-black/[.08] bg-transparent px-4 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/[.145]"
        />
        <FilterPanel activeCount={activeFilterCount}>
          <GenreFilter
            genres={genres}
            selectedGenreIds={selectedGenres}
            onToggle={toggleGenre}
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs">
              Sort by
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as TSortBy)}
                className="rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-foreground outline-none focus:border-foreground/40 dark:border-white/[.145]"
              >
                {sortOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    className="bg-background text-foreground"
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs">
              Min IMDb
              <select
                value={minImdb}
                onChange={(event) => setMinImdb(event.target.value)}
                className="rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-foreground outline-none focus:border-foreground/40 dark:border-white/[.145]"
              >
                {MIN_IMDB_OPTIONS.map((value) => (
                  <option
                    key={value}
                    value={value}
                    className="bg-background text-foreground"
                  >
                    {value ? `${value}+` : "Any"}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs">
              Min RT
              <select
                value={minRt}
                onChange={(event) => setMinRt(event.target.value)}
                className="rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-foreground outline-none focus:border-foreground/40 dark:border-white/[.145]"
              >
                {MIN_RT_OPTIONS.map((value) => (
                  <option
                    key={value}
                    value={value}
                    className="bg-background text-foreground"
                  >
                    {value ? `${value}%+` : "Any"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {filterFootnote}
        </FilterPanel>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg tracking-wide">{heading}</h2>
        {loading && <span className="text-sm text-foreground/60">Loading…</span>}
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : (
        <>
          <div
            className={`transition-opacity duration-150 ${loading ? "opacity-40" : "opacity-100"}`}
            aria-busy={loading}
          >
            <MovieGrid movies={items} basePath={basePath} eagerFirstRow />
          </div>
          {canLoadMore && (
            <button
              type="button"
              onClick={loadMoreDiscover}
              disabled={discoverLoadingMore}
              className="mx-auto rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-50 dark:border-white/[.145]"
            >
              {discoverLoadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
