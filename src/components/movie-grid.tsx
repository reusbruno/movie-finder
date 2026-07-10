import type { MovieWithMatch } from "@/lib/match-explanation";
import type { WatchlistMediaType } from "@/lib/watchlist";
import { MovieCard } from "@/components/movie-card";
import { gridItemVisibilityClass } from "@/lib/grid-visibility";

// The grid's widest breakpoint (xl:grid-cols-8) - up to this many cards can
// sit in the first visual row depending on viewport, and the browser's
// actual LCP candidate varies with it. Per Next's own guidance, that rules
// out `priority`/`preload` (meant for a single definite element) in favor
// of plain eager loading on the whole candidate set - see movie-card.tsx.
const MAX_COLUMNS = 8;

export function MovieGrid({
  movies,
  basePath = "movies",
  eagerFirstRow = false,
  canExplainMore = false,
  trimTrailingRow = false,
}: {
  // Per-item mediaType is optional - only the watchlist grid mixes movies
  // and TV in one grid and needs it; see movie-card.tsx.
  movies: (MovieWithMatch & { mediaType?: WatchlistMediaType })[];
  basePath?: "movies" | "series";
  // Only true for a grid that's the primary above-the-fold content (the
  // popular/discover/search grid on /movies and /series). Detail-page
  // recommendation grids render below the hero and cast list, so eagerly
  // loading their images would compete with the actually-visible content.
  eagerFirstRow?: boolean;
  // Whether the on-demand LLM elaboration is available - see movie-card.tsx.
  canExplainMore?: boolean;
  // Hides a ragged trailing partial row per breakpoint (gridItemVisibilityClass
  // in grid-visibility.ts) instead of showing an uneven last line. Defaults
  // to false - safe only when every hidden item stays reachable some other
  // way, e.g. a "Load more" button that will eventually reveal them. A grid
  // with no pagination (popular/mood/blend/search results, watchlist,
  // detail-page recommendations) must NOT trim: those items were already
  // fetched and have no other path to becoming visible, so hiding them
  // would silently discard real results rather than just tidy a row.
  trimTrailingRow?: boolean;
}) {
  if (movies.length === 0) {
    return (
      <p className="py-16 text-center text-foreground/60">No movies found.</p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
      {movies.map((movie, index) => (
        <div
          key={movie.id}
          className={
            trimTrailingRow ? gridItemVisibilityClass(index, movies.length) : undefined
          }
        >
          <MovieCard
            movie={movie}
            basePath={basePath}
            eager={eagerFirstRow && index < MAX_COLUMNS}
            canExplainMore={canExplainMore}
          />
        </div>
      ))}
    </div>
  );
}
