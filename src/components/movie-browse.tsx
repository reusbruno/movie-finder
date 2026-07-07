"use client";

import { useEffect, useRef, useState } from "react";
import {
  TMDB_MAX_DISCOVER_PAGE,
  type MovieSortBy,
  type TMDBGenre,
} from "@/lib/tmdb";
import type { MovieWithRatings } from "@/lib/ratings";
import { MovieGrid } from "@/components/movie-grid";

const SORT_OPTIONS: { value: MovieSortBy; label: string }[] = [
  { value: "popularity.desc", label: "Popularity" },
  { value: "vote_average.desc", label: "Top Rated" },
  { value: "primary_release_date.desc", label: "Newest" },
  { value: "title.asc", label: "Title (A-Z)" },
];

const MIN_IMDB_OPTIONS = ["", "6", "7", "8", "9"] as const;
const MIN_RT_OPTIONS = ["", "25", "50", "75", "90"] as const;

export function MovieBrowse({ genres }: { genres: TMDBGenre[] }) {
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<MovieSortBy>(SORT_OPTIONS[0].value);
  const [minImdb, setMinImdb] = useState("");
  const [minRt, setMinRt] = useState("");
  const [movies, setMovies] = useState<MovieWithRatings[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function toggleGenre(id: number) {
    setSelectedGenres((prev) =>
      prev.includes(id) ? prev.filter((genreId) => genreId !== id) : [...prev, id]
    );
  }

  function buildParams(targetPage: number) {
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

  useEffect(() => {
    const timeout = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const params = buildParams(1);

        const response = await fetch(`/api/movies/discover?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load movies");
        }

        setMovies(data.results);
        setPage(1);
        setTotalPages(data.total_pages);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load movies");
      } finally {
        setLoading(false);
      }
    }, 0);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGenres, sortBy, minImdb, minRt]);

  async function loadMore() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const nextPage = page + 1;

    setLoadingMore(true);
    setError(null);

    try {
      const params = buildParams(nextPage);

      const response = await fetch(`/api/movies/discover?${params.toString()}`, {
        signal: controller.signal,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load movies");
      }

      setMovies((prev) => [...prev, ...data.results]);
      setPage(nextPage);
      setTotalPages(data.total_pages);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to load movies");
    } finally {
      setLoadingMore(false);
    }
  }

  const canLoadMore = page < totalPages && page < TMDB_MAX_DISCOVER_PAGE;

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
          <legend className="mb-1 text-sm font-medium text-foreground/70">
            Genres
          </legend>
          {genres.map((genre) => (
            <label key={genre.id} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={selectedGenres.includes(genre.id)}
                onChange={() => toggleGenre(genre.id)}
              />
              {genre.name}
            </label>
          ))}
        </fieldset>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            Sort by
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as MovieSortBy)}
              className="rounded-md border border-black/[.08] bg-transparent px-2 py-1 dark:border-white/[.145]"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
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
              className="rounded-md border border-black/[.08] bg-transparent px-2 py-1 dark:border-white/[.145]"
            >
              {MIN_IMDB_OPTIONS.map((value) => (
                <option key={value} value={value}>
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
              className="rounded-md border border-black/[.08] bg-transparent px-2 py-1 dark:border-white/[.145]"
            >
              {MIN_RT_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value ? `${value}%+` : "Any"}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-foreground/60">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : (
        <>
          <MovieGrid movies={movies} />
          {canLoadMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="mx-auto rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium disabled:opacity-50 dark:border-white/[.145]"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
