"use client";

import { useEffect, useState } from "react";
import type { MovieWithRatings } from "@/lib/ratings";
import type { WatchlistMediaType } from "@/lib/watchlist";
import { useWatchlist } from "@/lib/use-watchlist";
import { MovieGrid } from "@/components/movie-grid";

type EnrichedItem = MovieWithRatings & { mediaType: WatchlistMediaType };

export function WatchlistView() {
  const { items } = useWatchlist();
  const [results, setResults] = useState<EnrichedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const key = items.map((item) => `${item.mediaType}:${item.id}`).join(",");

  useEffect(() => {
    // Nothing to fetch - the empty state is derived straight from `items`
    // in the render below, no fetch (and no synchronous setState here) needed.
    if (items.length === 0) return;

    let cancelled = false;

    fetch("/api/watchlist/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map(({ id, mediaType }) => ({ id, mediaType })),
      }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load watchlist");
        return response.json();
      })
      .then((data: { items: EnrichedItem[] }) => {
        if (!cancelled) {
          setResults(data.items);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load your watchlist. Try refreshing.");
      });

    return () => {
      cancelled = true;
    };
    // Re-fetch whenever the stored id/mediaType set changes (add/remove
    // from any card) - keyed on `key` rather than `items` since a fresh
    // localStorage read returns a new array reference every time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const isEmpty = items.length === 0;
  const isLoading = !isEmpty && results === null && !error;

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8">
      <h1 className="font-display text-xl tracking-wide">Watchlist</h1>
      {isEmpty ? (
        <p className="py-16 text-center text-foreground/60">
          Your watchlist is empty. Add titles from any movie or show card.
        </p>
      ) : error ? (
        <p className="py-16 text-center text-foreground/60">{error}</p>
      ) : isLoading ? (
        <p className="py-16 text-center text-foreground/60">Loading…</p>
      ) : (
        <MovieGrid movies={results ?? []} eagerFirstRow />
      )}
    </div>
  );
}
