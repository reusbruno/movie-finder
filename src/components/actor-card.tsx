import Image from "next/image";
import Link from "next/link";
import type { TMDBPerson } from "@/lib/tmdb";

const PROFILE_BASE_URL = "https://image.tmdb.org/t/p/w342";
const PROFILE_SIZES =
  "(min-width: 1280px) 12vw, (min-width: 768px) 16vw, (min-width: 640px) 25vw, 33vw";

export function ActorCard({ person }: { person: TMDBPerson }) {
  const knownFor = person.known_for
    .map((item) => item.title ?? item.name)
    .filter((title): title is string => Boolean(title))
    .slice(0, 2);

  return (
    <Link
      href={`/actors/${person.id}`}
      className="group relative block aspect-[2/3] overflow-hidden rounded-lg bg-black/[.04] transition-all duration-200 ease-out hover:z-10 hover:scale-[1.04] hover:shadow-lg hover:shadow-black/40 focus-visible:z-10 focus-visible:scale-[1.04] focus-visible:ring-2 focus-visible:ring-accent dark:bg-white/[.06]"
    >
      {person.profile_path ? (
        <Image
          src={`${PROFILE_BASE_URL}${person.profile_path}`}
          alt={person.name}
          fill
          sizes={PROFILE_SIZES}
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm text-foreground/60">
          No photo available
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pt-8 pb-2">
        <h3 className="line-clamp-2 text-base font-medium leading-tight text-white">
          {person.name}
        </h3>
        {knownFor.length > 0 && (
          <div className="grid grid-rows-[0fr] opacity-0 transition-all duration-200 ease-out group-hover:grid-rows-[1fr] group-hover:opacity-100 group-focus-visible:grid-rows-[1fr] group-focus-visible:opacity-100">
            <div className="overflow-hidden">
              <p className="line-clamp-2 pt-1 text-xs text-white/70">
                {knownFor.join(", ")}
              </p>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
