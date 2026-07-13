"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { TMDB_MAX_DISCOVER_PAGE, type TMDBGenre } from "@/lib/tmdb";
import type { MovieWithRatings } from "@/lib/ratings";
import { MovieGrid } from "@/components/movie-grid";
import { GenreFilter } from "@/components/genre-filter";
import { FilterPanel } from "@/components/filter-panel";
import { StreamingFilter } from "@/components/streaming-filter";
import { STREAMING_PROVIDERS } from "@/lib/watch-providers";
import type { PickedTitle } from "@/components/title-picker";
import { SkeletonGrid } from "@/components/skeletons";
import { HeroSearch } from "@/components/hero-search";
import { InterpretationChips } from "@/components/interpretation-chips";
import { useWatchRegion } from "@/lib/use-watch-region";

const SEARCH_DEBOUNCE_MS = 400;
const MIN_IMDB_OPTIONS = ["", "6", "7", "8", "9"] as const;
const MIN_RT_OPTIONS = ["", "25", "50", "75", "90"] as const;

// Surfaces mood search's resolved year range (if any) in the "Interpreted
// as: …" caption - otherwise temporal language like "modern" or "80s" was
// silently applied (or silently NOT applied) with no way to tell from the
// UI, which is exactly what made a past bug here hard to spot.
function formatYearRange(range?: { gte?: number; lte?: number }): string | null {
  if (!range?.gte && !range?.lte) return null;
  if (range.gte && range.lte) return `${range.gte}–${range.lte}`;
  if (range.gte) return `${range.gte}+`;
  return `through ${range.lte}`;
}

interface MoodInterpretation {
  genreNames: string[];
  keywordTerms: string[];
  sortBy: string;
  yearRange?: { gte?: number; lte?: number };
}

// Mirrors src/lib/mood-search.ts's ResolvedMoodParams - duplicated here
// (not imported) because that module pulls in the Anthropic SDK and can't
// be part of the client bundle. Carries the LLM's raw genre/keyword ids
// and names so a later filter change can re-run discovery against the
// same interpretation without spending another Anthropic call.
interface ResolvedMoodParams {
  genres: { id: number; name: string }[];
  keywords: { id: number; name: string }[];
  sortBy: string;
  yearRange?: { gte?: number; lte?: number };
}

export interface MediaExplorerConfig<TSortBy extends string> {
  basePath: "movies" | "series";
  searchEndpoint: string;
  discoverEndpoint: string;
  moodSearchEndpoint: string;
  vibeBlendEndpoint: string;
  // TMDB's own paginated popular endpoint - lets the Popular grid load more
  // pages the same way Discover mode does, rather than being capped at
  // whatever the server rendered for page 1.
  popularEndpoint: string;
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
  initialTotalPages,
  genres,
  config,
}: {
  initialItems: MovieWithRatings[];
  // TMDB's total_pages for the server-rendered page 1 - seeds
  // popularTotalPages so Load More knows immediately whether there's
  // anything more to fetch, without a wasted first click.
  initialTotalPages: number;
  genres: TMDBGenre[];
  config: MediaExplorerConfig<TSortBy>;
}) {
  const {
    basePath,
    searchEndpoint,
    discoverEndpoint,
    moodSearchEndpoint,
    vibeBlendEndpoint,
    popularEndpoint,
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
  const [selectedWatchProviders, setSelectedWatchProviders] = useState<number[]>([]);
  const { region } = useWatchRegion();
  // Provider ids aren't portable across regions (e.g. Prime Video is a
  // different id in the US vs Brazil - see watch-providers.ts). Rather than
  // clearing selectedWatchProviders on a region switch (which would mean
  // setState inside an effect just to synchronize derived state), filter to
  // only the ids valid in the CURRENT region wherever the filter is
  // actually applied - a stale id from another region simply stops
  // contributing until that region is selected again.
  // Memoized so it's referentially stable across renders that don't
  // actually change selectedWatchProviders/region - it's used as a
  // useEffect dependency below, where a fresh array identity every render
  // would defeat the "only refetch on a real change" guard those effects
  // rely on.
  const activeWatchProviderIds = useMemo(() => {
    const validIds = new Set(STREAMING_PROVIDERS[region].map((p) => p.id));
    return selectedWatchProviders.filter((id) => validIds.has(id));
  }, [selectedWatchProviders, region]);

  // null while the availability check is in flight - the input renders
  // disabled either way, so there's no flash of an enabled box.
  const [moodAvailable, setMoodAvailable] = useState<boolean | null>(null);
  const [moodInput, setMoodInput] = useState("");
  const [moodQuery, setMoodQuery] = useState("");
  const [moodResults, setMoodResults] = useState<MovieWithRatings[] | null>(null);
  const [moodInterpretation, setMoodInterpretation] = useState<MoodInterpretation | null>(
    null
  );
  // The LLM's raw interpretation, kept around so a filter change while mood
  // is active can re-run discovery (via cachedInterpretation below) without
  // spending another Anthropic call.
  const [moodResolvedParams, setMoodResolvedParams] = useState<ResolvedMoodParams | null>(
    null
  );
  const [moodLoading, setMoodLoading] = useState(false);
  // Which MOOD_PAGE_SIZE-sized tier of the already-ranked server-side pool
  // is currently loaded, and whether the pool has more beyond it (from the
  // response's own hasMore, not derived client-side - the pool's true depth
  // is only known server-side). Reset to page 1 on every fresh/cached
  // (non-load-more) fetch - see runMoodDiscovery.
  const [moodPage, setMoodPage] = useState(1);
  const [moodHasMore, setMoodHasMore] = useState(false);
  const [moodLoadingMore, setMoodLoadingMore] = useState(false);
  const [moodError, setMoodError] = useState<string | null>(null);
  // Separate from moodError: a 429 is an expected, self-inflicted,
  // transient state (same category as surpriseMessage below), not a real
  // failure - it renders as a quiet note near the input instead of the
  // red error text a genuine fetch failure gets.
  const [moodRateLimitMessage, setMoodRateLimitMessage] = useState<string | null>(null);
  const moodAbortRef = useRef<AbortController | null>(null);
  const moodRequestIdRef = useRef(0);
  // Tracks the filter state (genres/sort/ratings/providers) as of the last
  // mood fetch, so the filter-change effect below can tell "a filter
  // genuinely changed since we last asked" apart from "moodResolvedParams
  // just settled from our own fetch" - see the effect for how it's used.
  const moodFetchKeyRef = useRef<string | null>(null);
  // Which query moodResolvedParams currently reflects. A fresh submitMood
  // call invalidates this immediately (before its own response arrives), so
  // a filter change racing against that in-flight fresh query can never
  // reuse the OLD interpretation against the NEW moodQuery - see the
  // filter-change effect below, which checks this before firing.
  const moodResolvedQueryRef = useRef<string | null>(null);

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
  // See moodPage/moodHasMore above - same shape, applied to blend's own
  // already-scored candidate pool (a single TMDB discover page, fully
  // scored in one call - Load More reveals a later slice of it, not a
  // deeper fetch).
  const [blendPage, setBlendPage] = useState(1);
  const [blendHasMore, setBlendHasMore] = useState(false);
  const [blendLoadingMore, setBlendLoadingMore] = useState(false);
  const [blendError, setBlendError] = useState<string | null>(null);
  const blendAbortRef = useRef<AbortController | null>(null);
  const blendRequestIdRef = useRef(0);

  const [searchResults, setSearchResults] = useState<MovieWithRatings[] | null>(
    null
  );
  const [searchLoading, setSearchLoading] = useState(false);
  // TMDB's own paginated search endpoint - same shape as Popular/Discover's
  // own page tracking below.
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotalPages, setSearchTotalPages] = useState(1);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
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
  // TMDB's own total match count (not just how many are loaded so far) -
  // discover is the one mode with "Load more" pagination, so items.length
  // would only ever say "8 results" even when hundreds match. Mood/blend/
  // search aren't paginated in this UI, so items.length is already the
  // true total for those.
  const [discoverTotalResults, setDiscoverTotalResults] = useState(0);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverLoadingMore, setDiscoverLoadingMore] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const discoverAbortRef = useRef<AbortController | null>(null);
  const discoverRequestIdRef = useRef(0);

  // Page 1 is always the server-rendered initialItems - no fetch, no
  // pending state, same as before. Load More appends subsequent pages the
  // same way loadMoreDiscover does; only that accumulation is new here.
  const [popularItems, setPopularItems] = useState<MovieWithRatings[]>(initialItems);
  const [popularPage, setPopularPage] = useState(1);
  const [popularTotalPages, setPopularTotalPages] = useState(initialTotalPages);
  const [popularLoadingMore, setPopularLoadingMore] = useState(false);
  // Deliberately NOT wired into the shared `error` variable below - that
  // would replace the whole (already successfully server-rendered) grid
  // with red text over a single failed Load More click. Rendered as a
  // quiet note near the button instead, same category as surpriseMessage.
  const [popularError, setPopularError] = useState<string | null>(null);
  const popularAbortRef = useRef<AbortController | null>(null);
  const popularRequestIdRef = useRef(0);

  const router = useRouter();
  const [surpriseLoading, setSurpriseLoading] = useState(false);
  // Distinct from the error states above: "your filters matched nothing" is
  // an expected, calm outcome (not a failure), so it renders as a plain
  // note rather than the red error text a fetch failure gets.
  const [surpriseMessage, setSurpriseMessage] = useState<string | null>(null);

  // Pure UI state for the hero redesign - which input the hero card shows,
  // and whether the (unchanged) search+filters row is visible. Neither
  // touches the actual query/genre/sort/rating state below, so collapsing
  // the filters row never clears an active filter - see toggleFilters.
  const [heroView, setHeroView] = useState<"mood" | "blend">("mood");
  const [filtersRevealed, setFiltersRevealed] = useState(false);
  // Lifted out of FilterPanel (was its own internal useState) so it can be
  // forced open in one step from handleToggleFilters below, instead of
  // always starting collapsed on every reveal.
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  const trimmedQuery = query.trim();
  const filtersActive =
    sortBy !== defaultSort ||
    selectedGenres.length > 0 ||
    minImdb !== "" ||
    minRt !== "" ||
    activeWatchProviderIds.length > 0;

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
    moodFetchKeyRef.current = null;
    moodResolvedQueryRef.current = null;
    setMoodInput("");
    setMoodQuery("");
    setMoodResults(null);
    setMoodInterpretation(null);
    setMoodResolvedParams(null);
    setMoodError(null);
    setMoodRateLimitMessage(null);
    setMoodLoading(false);
    setMoodPage(1);
    setMoodHasMore(false);
    setMoodLoadingMore(false);
  }

  // Snapshot of the filter state a mood fetch is about to reflect - genre/
  // sort/rating/streaming overrides sent alongside the query, and the key
  // moodFetchKeyRef compares against to detect a later, genuine filter
  // change (see the effect below).
  function currentFilterKey() {
    return JSON.stringify({
      genres: [...selectedGenres].sort((a, b) => a - b),
      sortBy,
      minImdb,
      minRt,
      providers: [...activeWatchProviderIds].sort((a, b) => a - b),
      region,
    });
  }

  function moodFilterOverrides(): Record<string, unknown> {
    const overrides: Record<string, unknown> = {};
    if (selectedGenres.length > 0) overrides.genreIds = selectedGenres;
    if (sortBy !== defaultSort) overrides.sortBy = sortBy;
    if (minImdb) overrides.minImdb = Number(minImdb);
    if (minRt) overrides.minRt = Number(minRt);
    if (activeWatchProviderIds.length > 0) {
      overrides.watchProviderIds = activeWatchProviderIds;
      overrides.watchRegion = region;
    }
    return overrides;
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
    setBlendPage(1);
    setBlendHasMore(false);
    setBlendLoadingMore(false);
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
      setBlendPage(1);
      setBlendHasMore(Boolean(data.hasMore));
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

  async function loadMoreBlend() {
    if (!blendTitleA || !blendTitleB) return;

    blendAbortRef.current?.abort();
    const controller = new AbortController();
    blendAbortRef.current = controller;
    const requestId = ++blendRequestIdRef.current;

    const nextPage = blendPage + 1;

    setBlendLoadingMore(true);
    setBlendError(null);

    try {
      const params = new URLSearchParams({
        a: String(blendTitleA.id),
        b: String(blendTitleB.id),
        page: String(nextPage),
      });
      const response = await fetch(`${vibeBlendEndpoint}?${params.toString()}`, {
        signal: controller.signal,
      });
      const data = await response.json();

      if (requestId !== blendRequestIdRef.current) return;

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to blend titles");
      }

      setBlendResults((prev) => [...(prev ?? []), ...data.results]);
      setBlendPage(nextPage);
      setBlendHasMore(Boolean(data.hasMore));
    } catch (err) {
      if (requestId !== blendRequestIdRef.current) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      setBlendError(err instanceof Error ? err.message : "Failed to blend titles");
    } finally {
      if (requestId === blendRequestIdRef.current) {
        setBlendLoadingMore(false);
      }
    }
  }

  function updateQuery(value: string) {
    if (moodQuery) clearMood();
    if (blendActive) clearBlend();
    setQuery(value);
  }

  // Genre/sort/rating/streaming filters now compose with an active mood
  // search instead of clearing it (see the filter-change effect below) -
  // blend still doesn't compose with filters, so it's still cleared here.
  // Plain search text stays mutually exclusive with mood - see updateQuery.
  function toggleGenre(id: number) {
    if (blendActive) clearBlend();
    setSelectedGenres((prev) =>
      prev.includes(id) ? prev.filter((genreId) => genreId !== id) : [...prev, id]
    );
  }

  function updateSortBy(value: TSortBy) {
    if (blendActive) clearBlend();
    setSortBy(value);
  }

  function updateMinImdb(value: string) {
    if (blendActive) clearBlend();
    setMinImdb(value);
  }

  function updateMinRt(value: string) {
    if (blendActive) clearBlend();
    setMinRt(value);
  }

  function toggleWatchProvider(id: number) {
    if (blendActive) clearBlend();
    setSelectedWatchProviders((prev) =>
      prev.includes(id) ? prev.filter((providerId) => providerId !== id) : [...prev, id]
    );
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

  // Shared by a fresh query submission and a filter change while mood is
  // already active - the latter passes cachedInterpretation instead of
  // query, which skips the LLM call (and its rate limit) entirely on the
  // server. Active genre/sort/rating/streaming filters are sent as
  // overrides either way, so a filter set before a fresh mood submit is
  // respected immediately rather than only applying on the next change.
  async function runMoodDiscovery(
    payloadBase: { query: string } | { cachedInterpretation: ResolvedMoodParams },
    options: { page?: number } = {}
  ) {
    const page = options.page ?? 1;
    // page > 1 is Load More asking for the next tier of the already-ranked
    // pool - appends to moodResults and uses its own loading flag (so the
    // existing grid stays visible, undimmed, same pattern as
    // loadMoreDiscover/loadMorePopular) instead of replacing everything and
    // flipping the whole-grid moodLoading dim.
    const isLoadMore = page > 1;

    moodAbortRef.current?.abort();
    const controller = new AbortController();
    moodAbortRef.current = controller;
    const requestId = ++moodRequestIdRef.current;

    // A fresh query invalidates whatever moodResolvedParams currently holds
    // immediately - before this fetch's own response arrives - so the
    // filter-change effect below can't fire a cachedInterpretation request
    // against the OLD interpretation while this one is still in flight (it
    // checks moodResolvedQueryRef against moodQuery, which has already been
    // updated to the new query by the time this runs - see submitMood).
    if ("query" in payloadBase) {
      moodResolvedQueryRef.current = null;
    }

    moodFetchKeyRef.current = currentFilterKey();
    if (isLoadMore) {
      setMoodLoadingMore(true);
    } else {
      setMoodLoading(true);
    }
    setMoodError(null);
    setMoodRateLimitMessage(null);

    try {
      const response = await fetch(moodSearchEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payloadBase, ...moodFilterOverrides(), page }),
        signal: controller.signal,
      });
      const data = await response.json();

      if (requestId !== moodRequestIdRef.current) return;

      if (response.status === 429) {
        // Roll back to "no mood search happened" rather than leaving
        // mode stuck on "mood" with moodResults forever null - that would
        // pin the grid on its loading skeleton with no way out, which
        // reads as broken, not as "wait a moment". Only the fresh-query
        // path can actually hit this (the cached path isn't rate-limited,
        // and neither is Load More - it always sends cachedInterpretation).
        if ("query" in payloadBase) {
          setMoodQuery("");
        }
        setMoodRateLimitMessage(
          data.error ?? "Too many searches — wait a moment and try again."
        );
        return;
      }

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to interpret mood query");
      }

      if (isLoadMore) {
        setMoodResults((prev) => [...(prev ?? []), ...data.results]);
      } else {
        setMoodResults(data.results);
        setMoodInterpretation(data.interpretation ?? null);
        setMoodResolvedParams(data.resolvedParams ?? null);
        // Only the fresh-query path re-anchors which query this
        // interpretation belongs to - the cachedInterpretation path (both
        // a filter change and Load More use it) reuses the same
        // interpretation the original query already resolved, so the
        // anchor it set stays correct and shouldn't move.
        if ("query" in payloadBase) {
          moodResolvedQueryRef.current = payloadBase.query;
        }
      }
      setMoodPage(page);
      setMoodHasMore(Boolean(data.hasMore));
    } catch (err) {
      if (requestId !== moodRequestIdRef.current) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      setMoodError(
        err instanceof Error ? err.message : "Failed to interpret mood query"
      );
    } finally {
      if (requestId === moodRequestIdRef.current) {
        if (isLoadMore) {
          setMoodLoadingMore(false);
        } else {
          setMoodLoading(false);
        }
      }
    }
  }

  async function submitMood(rawQuery: string) {
    const trimmed = rawQuery.trim();
    if (!trimmed || !moodAvailable) return;

    if (blendActive) clearBlend();
    setQuery("");
    setMoodQuery(trimmed);
    await runMoodDiscovery({ query: trimmed });
  }

  function loadMoreMood() {
    if (!moodResolvedParams) return;
    runMoodDiscovery({ cachedInterpretation: moodResolvedParams }, { page: moodPage + 1 });
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
    if (activeWatchProviderIds.length > 0) {
      params.set("watch_providers", activeWatchProviderIds.join(","));
      params.set("region", region);
    }
    return params;
  }

  // Tied to the genre/sort/rating filters specifically (via the same
  // discoverEndpoint/buildDiscoverParams the filtered browse grid uses),
  // regardless of whatever mode (search/mood/blend) happens to be on
  // screen right now - a stray search query shouldn't change what
  // "respecting the active filters" means here. When no filters are set,
  // buildDiscoverParams still resolves to the same broad
  // sort_by=popularity.desc pool the Popular grid shows, so there's no
  // separate "no filters" branch needed.
  async function handleSurpriseMe() {
    setSurpriseLoading(true);
    setSurpriseMessage(null);

    try {
      const params = buildDiscoverParams(1);
      const response = await fetch(`${discoverEndpoint}?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? `Failed to load ${itemsLabel}`);
      }

      const results: MovieWithRatings[] = data.results ?? [];
      if (results.length === 0) {
        setSurpriseMessage("No titles match the current filters.");
        return;
      }

      const pick = results[Math.floor(Math.random() * results.length)];
      router.push(`/${basePath}/${pick.id}`);
    } catch (err) {
      setSurpriseMessage(
        err instanceof Error ? err.message : "Failed to pick a surprise title"
      );
    } finally {
      setSurpriseLoading(false);
    }
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
        setSearchPage(1);
        setSearchTotalPages(data.total_pages ?? 1);
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

  async function loadMoreSearch() {
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const requestId = ++searchRequestIdRef.current;

    const nextPage = searchPage + 1;

    setSearchLoadingMore(true);
    setSearchError(null);

    try {
      const response = await fetch(
        `${searchEndpoint}?query=${encodeURIComponent(trimmedQuery)}&page=${nextPage}`,
        { signal: controller.signal }
      );
      const data = await response.json();

      if (requestId !== searchRequestIdRef.current) return;

      if (!response.ok) {
        throw new Error(data.error ?? `Failed to search ${itemsLabel}`);
      }

      setSearchResults((prev) => [...(prev ?? []), ...data.results]);
      setSearchPage(nextPage);
      setSearchTotalPages(data.total_pages ?? nextPage);
    } catch (err) {
      if (requestId !== searchRequestIdRef.current) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      setSearchError(
        err instanceof Error ? err.message : `Failed to search ${itemsLabel}`
      );
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setSearchLoadingMore(false);
      }
    }
  }

  // Only runs when there's no query, at least one filter differs from its
  // default, and mood isn't active - otherwise the static Popular grid is
  // shown, no fetch. The moodQuery check matters now that filters compose
  // with mood instead of clearing it (see toggleGenre etc. above): without
  // it, a filter change while mood is active would still fire this discover
  // fetch in the background (mode stays "mood" so nothing renders it, but
  // it's a wasted TMDB/OMDb round trip on every filter tweak).
  useEffect(() => {
    if (trimmedQuery !== "" || !filtersActive || moodQuery !== "") {
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
        setDiscoverTotalResults(data.total_results ?? data.results.length);
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
  }, [
    trimmedQuery,
    selectedGenres,
    sortBy,
    minImdb,
    minRt,
    activeWatchProviderIds,
    region,
    moodQuery,
    discoverEndpoint,
    itemsLabel,
  ]);

  // Re-runs discovery against the mood interpretation already on hand
  // (moodResolvedParams) whenever a filter changes while mood is active -
  // this is what makes filters compose with mood instead of clearing it.
  // Guarded two ways: moodResolvedParams being null means the initial
  // query fetch hasn't resolved yet (nothing to re-run against), and the
  // key comparison distinguishes a genuine filter change from this effect
  // re-running merely because moodResolvedParams itself just settled from
  // that same initial fetch (moodFetchKeyRef is set at the start of every
  // mood fetch, so a matching key means "already reflects this state").
  useEffect(() => {
    if (moodQuery === "" || !moodResolvedParams) return;
    // moodResolvedParams can lag behind moodQuery for one render - e.g. a
    // fresh submitMood call updates moodQuery immediately but its
    // interpretation hasn't come back yet, so moodResolvedParams (and
    // moodResolvedQueryRef) still reflect the PREVIOUS query. Without this
    // check, this effect would fire a cachedInterpretation request that
    // composes the current filters against that stale interpretation
    // instead of waiting for the fresh one already in flight.
    if (moodResolvedQueryRef.current !== moodQuery) return;
    if (currentFilterKey() === moodFetchKeyRef.current) return;
    runMoodDiscovery({ cachedInterpretation: moodResolvedParams });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGenres, sortBy, minImdb, minRt, activeWatchProviderIds, region, moodQuery, moodResolvedParams]);

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
      setDiscoverTotalResults(data.total_results ?? data.results.length);
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

  async function loadMorePopular() {
    popularAbortRef.current?.abort();
    const controller = new AbortController();
    popularAbortRef.current = controller;
    const requestId = ++popularRequestIdRef.current;

    const nextPage = popularPage + 1;

    setPopularLoadingMore(true);
    setPopularError(null);

    try {
      const response = await fetch(`${popularEndpoint}?page=${nextPage}`, {
        signal: controller.signal,
      });
      const data = await response.json();

      if (requestId !== popularRequestIdRef.current) return;

      if (!response.ok) {
        throw new Error(data.error ?? `Failed to load ${itemsLabel}`);
      }

      setPopularItems((prev) => [...prev, ...data.results]);
      setPopularPage(nextPage);
      setPopularTotalPages(data.total_pages);
    } catch (err) {
      if (requestId !== popularRequestIdRef.current) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      setPopularError(
        err instanceof Error ? err.message : `Failed to load ${itemsLabel}`
      );
    } finally {
      if (requestId === popularRequestIdRef.current) {
        setPopularLoadingMore(false);
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
            : popularItems;

  // True only for "the request for this mode hasn't resolved even once
  // yet" (its results state is still null) - not for "resolved with zero
  // results" and not for "refetching over already-visible results" (e.g.
  // changing sort after a discover grid is already showing). Popular mode
  // always has initialItems, so it's never pending. Without this, `items`
  // above collapses "no response yet" and "response was empty" to the same
  // `[]`, and MovieGrid renders its permanent "No movies found." message
  // during the loading window too - the bug this fixes.
  const resultsPending =
    mode === "blend"
      ? blendResults === null
      : mode === "mood"
        ? moodResults === null
        : mode === "search"
          ? searchResults === null
          : mode === "discover"
            ? discoverResults === null
            : false;

  const moodYearRangeLabel = formatYearRange(moodInterpretation?.yearRange);
  const moodInterpretationLabels = moodInterpretation
    ? [
        ...moodInterpretation.genreNames,
        ...moodInterpretation.keywordTerms,
        ...(moodYearRangeLabel ? [moodYearRangeLabel] : []),
      ]
    : [];

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
  // Discover/Popular page through TMDB's own paginated endpoints; search
  // does too (TMDB's search endpoint is natively paginated, same as
  // Popular). Mood pages through its already-ranked server-side pool
  // (moodHasMore, computed server-side from the pool's real depth - see
  // mood-search.ts). Blend pages through its own already-scored candidate
  // pool the same way (blendHasMore) - a single TMDB discover page's worth
  // of candidates, so this typically exhausts after one Load More click.
  const canLoadMore =
    (mode === "discover" &&
      discoverPage < discoverTotalPages &&
      discoverPage < TMDB_MAX_DISCOVER_PAGE) ||
    (mode === "popular" &&
      popularPage < popularTotalPages &&
      popularPage < TMDB_MAX_DISCOVER_PAGE) ||
    (mode === "search" &&
      searchPage < searchTotalPages &&
      searchPage < TMDB_MAX_DISCOVER_PAGE) ||
    (mode === "mood" && moodHasMore) ||
    (mode === "blend" && blendHasMore);
  const loadingMore =
    mode === "discover"
      ? discoverLoadingMore
      : mode === "popular"
        ? popularLoadingMore
        : mode === "search"
          ? searchLoadingMore
          : mode === "mood"
            ? moodLoadingMore
            : mode === "blend"
              ? blendLoadingMore
              : false;

  function handleLoadMore() {
    if (mode === "discover") loadMoreDiscover();
    else if (mode === "popular") loadMorePopular();
    else if (mode === "search") loadMoreSearch();
    else if (mode === "mood") loadMoreMood();
    else if (mode === "blend") loadMoreBlend();
  }

  const activeFilterCount =
    (selectedGenres.length > 0 ? 1 : 0) +
    (sortBy !== defaultSort ? 1 : 0) +
    (minImdb ? 1 : 0) +
    (minRt ? 1 : 0) +
    (activeWatchProviderIds.length > 0 ? 1 : 0);
  // Shown on the collapsed "Browse with filters" entry point so results
  // never look mysteriously filtered/searched with no visible cause once
  // the row that set them is hidden - includes the quick-search query too,
  // not just genre/sort/rating, since a lingering query is just as "why do
  // these results look like this" as an active genre filter.
  const hiddenFilterSignal = activeFilterCount + (trimmedQuery !== "" ? 1 : 0);

  // Results headers are content labels, not page titles - Bebas Neue is
  // reserved for the latter (the hero heading), so every mode here renders
  // in normal weight. Each mode keeps its own existing context text
  // (unchanged copy), just with "· N results" appended once real results
  // have actually arrived - blend's own "Blending…" placeholder and every
  // other mode's resultsPending state already read fine without a count.
  const resultsHeaderContext =
    mode === "blend"
      ? blendCaption
        ? `Blending: ${blendCaption.titleA} + ${blendCaption.titleB}`
        : "Blending…"
      : mode === "mood"
        ? moodQuery.charAt(0).toUpperCase() + moodQuery.slice(1)
        : mode === "search"
          ? `Results for "${trimmedQuery}"`
          : mode === "discover"
            ? "Filtered"
            : popularHeading;
  const resultsCount = mode === "discover" ? discoverTotalResults : items.length;
  const showResultsCount = mode !== "popular" && !resultsPending && !error;
  const heading = showResultsCount
    ? `${resultsHeaderContext} · ${resultsCount} results`
    : resultsHeaderContext;

  function handleSwitchToBlend() {
    setHeroView("blend");
  }

  // Clearing blend here (not just switching the hero's own view back to
  // mood) keeps heroView and the results mode in agreement - otherwise the
  // hero would show the mood input while the grid below still said
  // "Blending: X + Y", which is exactly the "two now contradicting the
  // same signal" bug pattern this app has already hit once before.
  function handleBackToMood() {
    clearBlend();
    setHeroView("mood");
  }

  function handleToggleFilters() {
    setFiltersRevealed((prev) => {
      const next = !prev;
      // Opening while mood is active skips straight to the actual filter
      // controls in one click - the plain search input isn't shown in this
      // state (it composes with mood the same as every other filter, but
      // showing a text box that's irrelevant mid-mood just reads as
      // confusing), so there'd otherwise be nothing else to click through
      // to reach them. Browse mode (no mood) keeps the existing two-step
      // reveal-then-expand, since the search input genuinely belongs there.
      if (next && moodQuery !== "") {
        setFilterPanelOpen(true);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8">
      <HeroSearch
        heroView={heroView}
        onSwitchToBlend={handleSwitchToBlend}
        onBackToMood={handleBackToMood}
        moodInput={moodInput}
        onMoodInputChange={setMoodInput}
        onSubmitMood={() => submitMood(moodInput)}
        moodAvailable={moodAvailable}
        moodLoading={moodLoading}
        moodRateLimitMessage={moodRateLimitMessage}
        searchEndpoint={searchEndpoint}
        blendTitleA={blendTitleA}
        blendTitleB={blendTitleB}
        onSelectBlendA={setBlendTitleA}
        onClearBlendA={() => setBlendTitleA(null)}
        onSelectBlendB={setBlendTitleB}
        onClearBlendB={() => setBlendTitleB(null)}
        onSubmitBlend={submitBlend}
        blendLoading={blendLoading}
        onSurpriseMe={handleSurpriseMe}
        surpriseLoading={surpriseLoading}
        onToggleFilters={handleToggleFilters}
        filtersRevealed={filtersRevealed}
        filtersBadgeCount={hiddenFilterSignal}
      />

      {mode === "mood" && !moodLoading && moodInterpretation && (
        <InterpretationChips labels={moodInterpretationLabels} onClear={clearMood} />
      )}
      {mode === "blend" && !blendLoading && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/60">
          <button type="button" onClick={clearBlend} className="underline">
            Clear
          </button>
        </div>
      )}
      {surpriseMessage && (
        <p className="text-xs text-foreground/50">{surpriseMessage}</p>
      )}

      {filtersRevealed && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Irrelevant mid-mood (query is guaranteed empty whenever mood is
              active - submitting or composing a mood always clears it) and
              showing a text box that does nothing here just reads as
              confusing, so it's hidden rather than merely inert. */}
          {moodQuery === "" && (
            <input
              type="search"
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder.replace("…", "")}
              className="w-full max-w-md rounded-full border border-black/[.08] bg-transparent px-4 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/[.145]"
            />
          )}
          <FilterPanel
            activeCount={activeFilterCount}
            open={filterPanelOpen}
            onToggle={() => setFilterPanelOpen((prev) => !prev)}
          >
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
            <StreamingFilter
              region={region}
              selectedProviderIds={selectedWatchProviders}
              onToggle={toggleWatchProvider}
            />
            {filterFootnote}
          </FilterPanel>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground/70">{heading}</h2>
        {loading && <span className="text-sm text-foreground/60">Loading…</span>}
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : resultsPending ? (
        <SkeletonGrid />
      ) : (
        <>
          <div
            className={`transition-opacity duration-150 ${loading ? "opacity-40" : "opacity-100"}`}
            aria-busy={loading}
          >
            <MovieGrid
              movies={items}
              basePath={basePath}
              eagerFirstRow
              canExplainMore={moodAvailable === true}
              // Only Discover mode has "Load more", and only while
              // canLoadMore is true does it actually promise to reveal a
              // ragged trailing row later - once the last page is in
              // (canLoadMore false) or we're in any other mode, nothing
              // fetched should stay hidden with no way to reach it.
              trimTrailingRow={canLoadMore}
            />
          </div>
          {canLoadMore && (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="mx-auto rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-50 dark:border-white/[.145]"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
          {mode === "popular" && popularError && (
            <p className="text-center text-xs text-foreground/50">{popularError}</p>
          )}
        </>
      )}
    </div>
  );
}
