"use client";

import { useMemo, useState } from "react";
import type { TMDBCastCredit, TMDBGenre } from "@/lib/tmdb";
import { GenreFilter } from "@/components/genre-filter";
import { FilmographyGrid } from "@/components/filmography-grid";

export function ActorFilmography({
  credits,
  genres,
}: {
  credits: TMDBCastCredit[];
  genres: TMDBGenre[];
}) {
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");

  function toggleGenre(id: number) {
    setSelectedGenres((prev) =>
      prev.includes(id) ? prev.filter((genreId) => genreId !== id) : [...prev, id]
    );
  }

  const filtered = useMemo(() => {
    const from = fromYear ? Number(fromYear) : null;
    const to = toYear ? Number(toYear) : null;

    return credits
      .filter((credit) => {
        if (
          selectedGenres.length > 0 &&
          !selectedGenres.some((id) => credit.genre_ids.includes(id))
        ) {
          return false;
        }

        const year = credit.release_date
          ? Number(credit.release_date.slice(0, 4))
          : null;

        if (from !== null && (year === null || year < from)) return false;
        if (to !== null && (year === null || year > to)) return false;

        return true;
      })
      .sort((a, b) => (b.release_date ?? "").localeCompare(a.release_date ?? ""));
  }, [credits, selectedGenres, fromYear, toYear]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <GenreFilter
          genres={genres}
          selectedGenreIds={selectedGenres}
          onToggle={toggleGenre}
        />
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5">
            From
            <input
              type="number"
              inputMode="numeric"
              placeholder="Year"
              value={fromYear}
              onChange={(event) => setFromYear(event.target.value)}
              className="w-20 rounded-md border border-black/[.08] bg-transparent px-2 py-1 dark:border-white/[.145]"
            />
          </label>
          <label className="flex items-center gap-1.5">
            To
            <input
              type="number"
              inputMode="numeric"
              placeholder="Year"
              value={toYear}
              onChange={(event) => setToYear(event.target.value)}
              className="w-20 rounded-md border border-black/[.08] bg-transparent px-2 py-1 dark:border-white/[.145]"
            />
          </label>
        </div>
      </div>
      <FilmographyGrid credits={filtered} />
    </div>
  );
}
