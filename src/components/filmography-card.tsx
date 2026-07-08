import Link from "next/link";
import type { TMDBCastCredit } from "@/lib/tmdb";

const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w342";

export function FilmographyCard({ credit }: { credit: TMDBCastCredit }) {
  const year = credit.release_date ? credit.release_date.slice(0, 4) : null;
  const isTV = credit.media_type === "tv";

  return (
    <Link
      href={`/${isTV ? "series" : "movies"}/${credit.id}`}
      className="flex flex-col gap-2"
    >
      <div className="aspect-[2/3] w-full overflow-hidden rounded-lg bg-black/[.04] dark:bg-white/[.06]">
        {credit.poster_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${POSTER_BASE_URL}${credit.poster_path}`}
            alt={`${credit.title} poster`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm text-foreground/60">
            No poster available
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <h3 className="line-clamp-2 text-sm font-medium leading-tight">
          {credit.title}
        </h3>
        <p className="text-xs text-foreground/60">
          {year ?? "Unknown year"}
          {isTV ? " · TV" : ""}
        </p>
        {credit.character && (
          <p className="line-clamp-1 text-xs text-foreground/60">
            as {credit.character}
          </p>
        )}
      </div>
    </Link>
  );
}
