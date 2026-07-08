import type { TMDBCastMember } from "@/lib/tmdb";
import { CastMemberCard } from "@/components/cast-member-card";

export function CastList({ cast }: { cast: TMDBCastMember[] }) {
  if (cast.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {cast.map((member) => (
        <CastMemberCard key={member.credit_id} member={member} />
      ))}
    </div>
  );
}
