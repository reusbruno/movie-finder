"use client";

import { useEffect, useRef, useState } from "react";
import {
  TMDB_MAX_DISCOVER_PAGE,
  type TVSortBy,
  type TMDBGenre,
} from "@/lib/tmdb";
import type { MovieWithRatings } from "@/lib/ratings";
import { MovieGrid } from "@/components/movie-grid";
import { GenreFilter } from "@/components/genre-filter";

const SEARCH_DEBOUNCE_MS = 400;

const SORT_OPTIONS: { value: TVSortBy; label: string }[] = [
  { value: "popularity.desc", label: "Popularity" },
  { value: "vote_average.desc", label: "Top Rated" },
  { value: "first_air_date.desc", label: "Newest" },
  { value: "name.asc", label: "Title (A-Z)" },
];
const DEFAULT_SORT = SORT_OPTIONS[0].value;

const MIN_IMDB_OPTIONS = ["", "6", "7", "8", "9"] as const;
const MIN_RT_OPTIONS = ["", "25", "50", "75", "90"] as const;

export function SeriesExplorer({
  initialShows,
  genres,
}: {
  initialShows: MovieWithRatings[];
  genres: TMDBGenre[];
}) {
  const [query, setQuery] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<TVSortBy>(DEFAULT_SORT);
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
    sortBy !== DEFAULT_SORT ||
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
          `/api/tv/search?query=${encodeURIComponent(trimmedQuery)}`,
          { signal: controller.signal }
        );
        const data = await response.json();

        if (requestId !== searchRequestIdRef.current) return;

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to search TV shows");
        }

        setSearchResults(data.results);
      } catch (err) {
        if (requestId !== searchRequestIdRef.current) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSearchError(err instanceof Error ? err.message : "Failed to search TV shows");
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setSearchLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [trimmedQuery]);

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

        const response = await fetch(`/api/tv/discover?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await response.json();

        if (requestId !== discoverRequestIdRef.current) return;

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load TV shows");
        }

        setDiscoverResults(data.results);
        setDiscoverPage(1);
        setDiscoverTotalPages(data.total_pages);
      } catch (err) {
        if (requestId !== discoverRequestIdRef.current) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setDiscoverError(err instanceof Error ? err.message : "Failed to load TV shows");
      } finally {
        if (requestId === discoverRequestIdRef.current) {
          setDiscoverLoading(false);
        }
      }
    }, 0);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedQuery, selectedGenres, sortBy, minImdb, minRt]);

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

      const response = await fetch(`/api/tv/discover?${params.toString()}`, {
        signal: controller.signal,
      });
      const data = await response.json();

      if (requestId !== discoverRequestIdRef.current) return;

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load TV shows");
      }

      setDiscoverResults((prev) => [...(prev ?? []), ...data.results]);
      setDiscoverPage(nextPage);
      setDiscoverTotalPages(data.total_pages);
    } catch (err) {
      if (requestId !== discoverRequestIdRef.current) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      setDiscoverError(err instanceof Error ? err.message : "Failed to load TV shows");
    } finally {
      if (requestId === discoverRequestIdRef.current) {
        setDiscoverLoadingMore(false);
      }
    }
  }

  const shows =
    mode === "search"
      ? (searchResults ?? [])
      : mode === "discover"
        ? (discoverResults ?? [])
        : initialShows;

  const heading =
    mode === "search"
      ? `Results for "${trimmedQuery}"`
      : mode === "discover"
        ? "Filtered results"
        : "Popular series";

  const loading = mode === "search" ? searchLoading : mode === "discover" ? discoverLoading : false;
  const error = mode === "search" ? searchError : mode === "discover" ? discoverError : null;
  const canLoadMore =
    mode === "discover" &&
    discoverPage < discoverTotalPages &&
    discoverPage < TMDB_MAX_DISCOVER_PAGE;

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search series…"
        aria-label="Search series"
        className="w-full max-w-md rounded-full border border-black/[.08] bg-transparent px-4 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/[.145]"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <GenreFilter
          genres={genres}
          selectedGenreIds={selectedGenres}
          onToggle={toggleGenre}
        />
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            Sort by
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as TVSortBy)}
              className="rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-foreground dark:border-white/[.145]"
            >
              {SORT_OPTIONS.map((option) => (
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
          <label className="flex items-center gap-2 text-sm">
            Min IMDb
            <select
              value={minImdb}
              onChange={(event) => setMinImdb(event.target.value)}
              className="rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-foreground dark:border-white/[.145]"
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
          <label className="flex items-center gap-2 text-sm">
            Min RT
            <select
              value={minRt}
              onChange={(event) => setMinRt(event.target.value)}
              className="rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-foreground dark:border-white/[.145]"
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
      </div>

      <p className="text-xs text-foreground/50">
        Rotten Tomatoes scores are frequently unavailable for TV shows in our
        data source, even for popular ones — a missing score doesn&apos;t
        mean it doesn&apos;t exist elsewhere.
      </p>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{heading}</h2>
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
            <MovieGrid movies={shows} basePath="series" />
          </div>
          {canLoadMore && (
            <button
              type="button"
              onClick={loadMoreDiscover}
              disabled={discoverLoadingMore}
              className="mx-auto rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium disabled:opacity-50 dark:border-white/[.145]"
            >
              {discoverLoadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
