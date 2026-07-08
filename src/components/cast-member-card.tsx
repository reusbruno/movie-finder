import Link from "next/link";
import type { TMDBCastMember } from "@/lib/tmdb";

const PROFILE_BASE_URL = "https://image.tmdb.org/t/p/w185";

export function CastMemberCard({ member }: { member: TMDBCastMember }) {
  return (
    <Link href={`/actors/${member.id}`} className="flex flex-col gap-2">
      <div className="aspect-[2/3] w-full overflow-hidden rounded-lg bg-black/[.04] dark:bg-white/[.06]">
        {member.profile_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${PROFILE_BASE_URL}${member.profile_path}`}
            alt={member.name}
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
          {member.name}
        </h3>
        {member.character && (
          <p className="line-clamp-1 text-xs text-foreground/60">
            as {member.character}
          </p>
        )}
      </div>
    </Link>
  );
}
