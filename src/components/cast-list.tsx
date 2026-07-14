import type { TMDBCastMember } from "@/lib/tmdb";
import { CastMemberCard } from "@/components/cast-member-card";
import { gridItemVisibilityClass } from "@/lib/grid-visibility";

export function CastList({
  cast,
  lang,
}: {
  cast: TMDBCastMember[];
  // Appended to each card's actor-page link as ?lang= - only meaningful
  // from a server-rendered detail page (see movies/[id]/page.tsx), which
  // has no other way to pass its resolved locale to the next server-
  // rendered page a click lands on. Omitted entirely by any other caller.
  lang?: string;
}) {
  if (cast.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
      {cast.map((member, index) => (
        <div
          key={member.credit_id}
          className={gridItemVisibilityClass(index, cast.length)}
        >
          <CastMemberCard member={member} lang={lang} />
        </div>
      ))}
    </div>
  );
}
