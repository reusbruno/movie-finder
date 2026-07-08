import type { TMDBCastCredit } from "@/lib/tmdb";
import { FilmographyCard } from "@/components/filmography-card";

export function FilmographyGrid({ credits }: { credits: TMDBCastCredit[] }) {
  if (credits.length === 0) {
    return (
      <p className="py-16 text-center text-foreground/60">
        No movies match these filters.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {credits.map((credit) => (
        <FilmographyCard key={credit.credit_id} credit={credit} />
      ))}
    </div>
  );
}
