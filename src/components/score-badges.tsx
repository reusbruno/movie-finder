export function ScoreBadges({
  tmdbScore,
  imdbRating,
  rtScore,
}: {
  tmdbScore: number;
  imdbRating: number | null;
  rtScore: number | null;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2">
      <span className="inline-flex items-center gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/tmdb-icon.svg" alt="TMDB" className="h-3 w-3 shrink-0" />
        {tmdbScore.toFixed(1)}
      </span>
      <span aria-hidden>·</span>
      <span className="inline-flex items-center gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/imdb-logo.svg" alt="IMDb" className="h-3 w-auto shrink-0" />
        {imdbRating !== null ? imdbRating.toFixed(1) : "—"}
      </span>
      <span aria-hidden>·</span>
      <span className="inline-flex items-center gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/rt-logo.svg" alt="Rotten Tomatoes" className="h-3 w-3 shrink-0" />
        {rtScore !== null ? `${rtScore}%` : "—"}
      </span>
    </span>
  );
}
