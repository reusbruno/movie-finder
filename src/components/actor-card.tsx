import Link from "next/link";
import type { TMDBPerson } from "@/lib/tmdb";

const PROFILE_BASE_URL = "https://image.tmdb.org/t/p/w185";

export function ActorCard({ person }: { person: TMDBPerson }) {
  const knownFor = person.known_for
    .filter((item) => item.media_type === "movie" && item.title)
    .slice(0, 2);

  return (
    <Link href={`/actors/${person.id}`} className="flex flex-col gap-2">
      <div className="aspect-[2/3] w-full overflow-hidden rounded-lg bg-black/[.04] dark:bg-white/[.06]">
        {person.profile_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${PROFILE_BASE_URL}${person.profile_path}`}
            alt={person.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm text-foreground/60">
            No photo available
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <h3 className="line-clamp-2 text-sm font-medium leading-tight">
          {person.name}
        </h3>
        {knownFor.length > 0 && (
          <p className="line-clamp-2 text-xs text-foreground/60">
            {knownFor.map((item) => item.title).join(", ")}
          </p>
        )}
      </div>
    </Link>
  );
}
