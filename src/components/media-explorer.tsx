"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { TMDB_MAX_DISCOVER_PAGE, type TMDBGenre } from "@/lib/tmdb";
import type { MovieWithRatings } from "@/lib/ratings";
import { MovieGrid } from "@/components/movie-grid";
import { GenreFilter } from "@/components/genre-filter";
import { FilterPanel } from "@/components/filter-panel";
import { TitlePicker, type PickedTitle } from "@/components/title-picker";

const SEARCH_DEBOUNCE_MS = 400;
const MIN_IMDB_OPTIONS = ["", "6", "7", "8", "9"] as const;
const MIN_RT_OPTIONS = ["", "25", "50", "75", "90"] as const;

interface MoodInterpretation {
  genreNames: string[];
  keywordTerms: string[];
  sortBy: string;
}

export interface MediaExplorerConfig<TSortBy extends string> {
  basePath: "movies" | "series";
  searchEndpoint: string;
  discoverEndpoint: string;
  moodSearchEndpoint: string;
  vibeBlendEndpoint: string;
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
    moodSearchEndpoint,
    vibeBlendEndpoint,
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

  // null while the availability check is in flight - the input renders
  // disabled either way, so there's no flash of an enabled box.
  const [moodAvailable, setMoodAvailable] = useState<boolean | null>(null);
  const [moodInput, setMoodInput] = useState("");
  const [moodQuery, setMoodQuery] = useState("");
  const [moodResults, setMoodResults] = useState<MovieWithRatings[] | null>(null);
  const [moodInterpretation, setMoodInterpretation] = useState<MoodInterpretation | null>(
    null
  );
  const [moodLoading, setMoodLoading] = useState(false);
  const [moodError, setMoodError] = useState<string | null>(null);
  const moodAbortRef = useRef<AbortController | null>(null);
  const moodRequestIdRef = useRef(0);

  const [blendTitleA, setBlendTitleA] = useState<PickedTitle | null>(null);
  const [blendTitleB, setBlendTitleB] = useState<PickedTitle | null>(null);
  // Set once a blend has actually been submitted - distinct from
  // blendTitleA/B (which track the picker selections) so picking a title
  // doesn't itself trigger "blend" mode before the Blend button is pressed.
  const [blendActive, setBlendActive] = useState(false);
  const [blendResults, setBlendResults] = useState<MovieWithRatings[] | null>(null);
  const [blendCaption, setBlendCaption] = useState<{
    titleA: string;
    titleB: string;
  } | null>(null);
  const [blendLoading, setBlendLoading] = useState(false);
  const [blendError, setBlendError] = useState<string | null>(null);
  const blendAbortRef = useRef<AbortController | null>(null);
  const blendRequestIdRef = useRef(0);

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

  // Blend and mood search are both explicit, deliberate actions (submit, not
  // live-typing), so they take priority over the passive search/filter
  // modes until cleared. They're mutually exclusive with each other too -
  // submitting one clears the other.
  const mode: "blend" | "mood" | "search" | "discover" | "popular" =
    blendActive
      ? "blend"
      : moodQuery !== ""
        ? "mood"
        : trimmedQuery !== ""
          ? "search"
          : filtersActive
            ? "discover"
            : "popular";

  function clearMood() {
    moodAbortRef.current?.abort();
    moodRequestIdRef.current += 1;
    setMoodQuery("");
    setMoodResults(null);
    setMoodInterpretation(null);
    setMoodError(null);
    setMoodLoading(false);
  }

  function clearBlend() {
    blendAbortRef.current?.abort();
    blendRequestIdRef.current += 1;
    setBlendActive(false);
    setBlendTitleA(null);
    setBlendTitleB(null);
    setBlendResults(null);
    setBlendCaption(null);
    setBlendError(null);
    setBlendLoading(false);
  }

  async function submitBlend() {
    if (!blendTitleA || !blendTitleB || blendTitleA.id === blendTitleB.id) return;

    blendAbortRef.current?.abort();
    const controller = new AbortController();
    blendAbortRef.current = controller;
    const requestId = ++blendRequestIdRef.current;

    if (moodQuery) clearMood();
    setQuery("");
    setSelectedGenres([]);
    setSortBy(defaultSort);
    setMinImdb("");
    setMinRt("");
    setBlendActive(true);
    setBlendLoading(true);
    setBlendError(null);

    try {
      const params = new URLSearchParams({
        a: String(blendTitleA.id),
        b: String(blendTitleB.id),
      });
      const response = await fetch(`${vibeBlendEndpoint}?${params.toString()}`, {
        signal: controller.signal,
      });
      const data = await response.json();

      if (requestId !== blendRequestIdRef.current) return;

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to blend titles");
      }

      setBlendResults(data.results);
      setBlendCaption(
        data.titleA && data.titleB
          ? { titleA: data.titleA.title, titleB: data.titleB.title }
          : null
      );
    } catch (err) {
      if (requestId !== blendRequestIdRef.current) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      setBlendError(err instanceof Error ? err.message : "Failed to blend titles");
    } finally {
      if (requestId === blendRequestIdRef.current) {
        setBlendLoading(false);
      }
    }
  }

  function updateQuery(value: string) {
    if (moodQuery) clearMood();
    if (blendActive) clearBlend();
    setQuery(value);
  }

  function toggleGenre(id: number) {
    if (moodQuery) clearMood();
    if (blendActive) clearBlend();
    setSelectedGenres((prev) =>
      prev.includes(id) ? prev.filter((genreId) => genreId !== id) : [...prev, id]
    );
  }

  function updateSortBy(value: TSortBy) {
    if (moodQuery) clearMood();
    if (blendActive) clearBlend();
    setSortBy(value);
  }

  function updateMinImdb(value: string) {
    if (moodQuery) clearMood();
    if (blendActive) clearBlend();
    setMinImdb(value);
  }

  function updateMinRt(value: string) {
    if (moodQuery) clearMood();
    if (blendActive) clearBlend();
    setMinRt(value);
  }

  // Checked once on mount - the mood input renders visible-but-disabled
  // until this resolves, rather than only failing on first submit.
  useEffect(() => {
    let cancelled = false;
    fetch(moodSearchEndpoint)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setMoodAvailable(Boolean(data.available));
      })
      .catch(() => {
        if (!cancelled) setMoodAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [moodSearchEndpoint]);

  async function submitMood(rawQuery: string) {
    const trimmed = rawQuery.trim();
    if (!trimmed || !moodAvailable) return;

    moodAbortRef.current?.abort();
    const controller = new AbortController();
    moodAbortRef.current = controller;
    const requestId = ++moodRequestIdRef.current;

    if (blendActive) clearBlend();
    setQuery("");
    setSelectedGenres([]);
    setSortBy(defaultSort);
    setMinImdb("");
    setMinRt("");
    setMoodQuery(trimmed);
    setMoodLoading(true);
    setMoodError(null);

    try {
      const response = await fetch(moodSearchEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
        signal: controller.signal,
      });
      const data = await response.json();

      if (requestId !== moodRequestIdRef.current) return;

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to interpret mood query");
      }

      setMoodResults(data.results);
      setMoodInterpretation(data.interpretation ?? null);
    } catch (err) {
      if (requestId !== moodRequestIdRef.current) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      setMoodError(
        err instanceof Error ? err.message : "Failed to interpret mood query"
      );
    } finally {
      if (requestId === moodRequestIdRef.current) {
        setMoodLoading(false);
      }
    }
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
    mode === "blend"
      ? (blendResults ?? [])
      : mode === "mood"
        ? (moodResults ?? [])
        : mode === "search"
          ? (searchResults ?? [])
          : mode === "discover"
            ? (discoverResults ?? [])
            : initialItems;

  const heading =
    mode === "blend"
      ? blendCaption
        ? `Blending: ${blendCaption.titleA} + ${blendCaption.titleB}`
        : "Blending…"
      : mode === "mood"
        ? `Mood: "${moodQuery}"`
        : mode === "search"
          ? `Results for "${trimmedQuery}"`
          : mode === "discover"
            ? "Filtered results"
            : popularHeading;

  const loading =
    mode === "blend"
      ? blendLoading
      : mode === "mood"
        ? moodLoading
        : mode === "search"
          ? searchLoading
          : mode === "discover"
            ? discoverLoading
            : false;
  const error =
    mode === "blend"
      ? blendError
      : mode === "mood"
        ? moodError
        : mode === "search"
          ? searchError
          : mode === "discover"
            ? discoverError
            : null;
  // Blend and mood results aren't paginated in v1 - both are one-shot
  // queries against a fixed candidate pool, not a stable filter set to page
  // through.
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
      <div className="flex flex-col gap-2">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitMood(moodInput);
          }}
          className="flex w-full max-w-md flex-wrap items-center gap-2"
        >
          <input
            type="text"
            value={moodInput}
            onChange={(event) => setMoodInput(event.target.value)}
            placeholder="Describe a mood… e.g. slow melancholic sci-fi"
            aria-label="Mood search"
            disabled={!moodAvailable}
            className="min-w-0 flex-1 rounded-full border border-black/[.08] bg-transparent px-4 py-2 text-sm outline-none focus:border-foreground/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.145]"
          />
          <button
            type="submit"
            disabled={!moodAvailable || !moodInput.trim()}
            className="rounded-full border border-black/[.08] px-4 py-2 text-sm font-medium transition-colors hover:border-foreground/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.145]"
          >
            {moodLoading ? "Thinking…" : "Search"}
          </button>
        </form>
        {moodAvailable === false && (
          <p className="text-xs text-foreground/50">Mood search — coming soon</p>
        )}
        {mode === "mood" && !moodLoading && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/60">
            {moodInterpretation && (
              <span>
                Interpreted as:{" "}
                {[...moodInterpretation.genreNames, ...moodInterpretation.keywordTerms].join(
                  ", "
                ) || "no specific filters"}
              </span>
            )}
            <button type="button" onClick={clearMood} className="underline">
              Clear
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <TitlePicker
            searchEndpoint={searchEndpoint}
            placeholder="First title…"
            selected={blendTitleA}
            onSelect={setBlendTitleA}
            onClear={() => setBlendTitleA(null)}
          />
          <span className="text-sm text-foreground/50">+</span>
          <TitlePicker
            searchEndpoint={searchEndpoint}
            placeholder="Second title…"
            selected={blendTitleB}
            onSelect={setBlendTitleB}
            onClear={() => setBlendTitleB(null)}
          />
          <button
            type="button"
            onClick={submitBlend}
            disabled={
              !blendTitleA || !blendTitleB || blendTitleA.id === blendTitleB.id
            }
            className="rounded-full border border-black/[.08] px-4 py-2 text-sm font-medium transition-colors hover:border-foreground/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.145]"
          >
            {blendLoading ? "Blending…" : "Blend"}
          </button>
        </div>
        {blendTitleA && blendTitleB && blendTitleA.id === blendTitleB.id && (
          <p className="text-xs text-foreground/50">Pick two different titles to blend</p>
        )}
        {mode === "blend" && !blendLoading && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/60">
            <button type="button" onClick={clearBlend} className="underline">
              Clear
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
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
                onChange={(event) => updateSortBy(event.target.value as TSortBy)}
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
                onChange={(event) => updateMinImdb(event.target.value)}
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
                onChange={(event) => updateMinRt(event.target.value)}
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
