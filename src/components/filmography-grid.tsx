"use client";

import type { TMDBCastCredit } from "@/lib/tmdb";
import { FilmographyCard } from "@/components/filmography-card";
import { gridItemVisibilityClass } from "@/lib/grid-visibility";
import { useLanguage } from "@/components/language-provider";

export function FilmographyGrid({ credits }: { credits: TMDBCastCredit[] }) {
  const { t } = useLanguage();

  if (credits.length === 0) {
    return (
      <p className="py-16 text-center text-foreground/60">
        {t.filmography.noResults}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
      {credits.map((credit, index) => (
        <div
          key={credit.credit_id}
          className={gridItemVisibilityClass(index, credits.length)}
        >
          <FilmographyCard credit={credit} />
        </div>
      ))}
    </div>
  );
}
