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
      <span>TMDB {tmdbScore.toFixed(1)}</span>
      <span aria-hidden>·</span>
      <span>IMDb {imdbRating !== null ? imdbRating.toFixed(1) : "—"}</span>
      <span aria-hidden>·</span>
      <span>RT {rtScore !== null ? `${rtScore}%` : "—"}</span>
    </span>
  );
}
