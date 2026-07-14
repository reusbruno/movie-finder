import type { TMDBGenre, MovieSortBy } from "@/lib/tmdb";
import type { MovieWithRatings } from "@/lib/ratings";
import { MediaExplorer, type MediaExplorerConfig } from "@/components/media-explorer";

const MOVIES_CONFIG: MediaExplorerConfig<MovieSortBy> = {
  basePath: "movies",
  searchEndpoint: "/api/movies/search",
  discoverEndpoint: "/api/movies/discover",
  moodSearchEndpoint: "/api/movies/mood-search",
  vibeBlendEndpoint: "/api/movies/vibe-blend",
  popularEndpoint: "/api/movies/popular",
  genresEndpoint: "/api/movies/genres",
  sortOptions: [
    { value: "popularity.desc" },
    { value: "vote_average.desc" },
    { value: "primary_release_date.desc" },
    { value: "title.asc" },
  ],
  defaultSort: "popularity.desc",
};

export function MoviesView({
  initialMovies,
  initialTotalPages,
  genres,
}: {
  initialMovies: MovieWithRatings[];
  initialTotalPages: number;
  genres: TMDBGenre[];
}) {
  return (
    <MediaExplorer
      initialItems={initialMovies}
      initialTotalPages={initialTotalPages}
      genres={genres}
      config={MOVIES_CONFIG}
    />
  );
}
