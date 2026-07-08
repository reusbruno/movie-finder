import type { TMDBCastMember } from "@/lib/tmdb";
import { CastMemberCard } from "@/components/cast-member-card";
import { gridItemVisibilityClass } from "@/lib/grid-visibility";

export function CastList({ cast }: { cast: TMDBCastMember[] }) {
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
          <CastMemberCard member={member} />
        </div>
      ))}
    </div>
  );
}
