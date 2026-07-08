import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getMovieGenres,
  getPersonDetails,
  getPersonMovieCredits,
  getPersonTVCredits,
  getTVGenres,
  TMDBError,
  type TMDBGenre,
} from "@/lib/tmdb";
import { ActorFilmography } from "@/components/actor-filmography";

const PROFILE_BASE_URL = "https://image.tmdb.org/t/p/w342";

function mergeGenres(a: TMDBGenre[], b: TMDBGenre[]): TMDBGenre[] {
  const byId = new Map<number, TMDBGenre>();
  for (const genre of [...a, ...b]) {
    byId.set(genre.id, genre);
  }
  return [...byId.values()];
}

export default async function ActorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const personId = Number(id);

  if (!Number.isInteger(personId) || personId < 1) {
    notFound();
  }

  // Started immediately, alongside getPersonDetails below - none of these
  // four depend on the details response.
  const movieCreditsPromise = getPersonMovieCredits(personId);
  const tvCreditsPromise = getPersonTVCredits(personId);
  const movieGenresPromise = getMovieGenres();
  const tvGenresPromise = getTVGenres();
  // See src/app/movies/[id]/page.tsx - pre-empt a false "unhandled
  // rejection" if any of these settle before getPersonDetails below; the
  // real error is still observed via Promise.all.
  movieCreditsPromise.catch(() => {});
  tvCreditsPromise.catch(() => {});
  movieGenresPromise.catch(() => {});
  tvGenresPromise.catch(() => {});

  let details;
  try {
    details = await getPersonDetails(personId);
  } catch (error) {
    if (error instanceof TMDBError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const [movieCredits, tvCredits, movieGenres, tvGenres] = await Promise.all([
    movieCreditsPromise,
    tvCreditsPromise,
    movieGenresPromise,
    tvGenresPromise,
  ]);

  const combinedCredits = [...movieCredits.cast, ...tvCredits.cast];
  const combinedGenres = mergeGenres(movieGenres.genres, tvGenres.genres);

  return (
    <div className="flex flex-1 flex-col gap-10 px-6 py-8">
      <Link
        href="/movies"
        className="w-fit text-sm text-foreground/60 hover:text-foreground"
      >
        ← Back to Movies
      </Link>
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="relative aspect-[2/3] w-full max-w-[220px] shrink-0 overflow-hidden rounded-lg bg-black/[.04] dark:bg-white/[.06]">
          {details.profile_path ? (
            <Image
              src={`${PROFILE_BASE_URL}${details.profile_path}`}
              alt={details.name}
              fill
              sizes="(min-width: 640px) 220px, 100vw"
              priority
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-center text-sm text-foreground/60">
              No photo available
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <h1 className="font-display text-xl tracking-wide">
            {details.name}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed">
            {details.biography || "No biography available."}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="font-display text-lg tracking-wide">Filmography</h2>
        <ActorFilmography credits={combinedCredits} genres={combinedGenres} />
      </div>
    </div>
  );
}
