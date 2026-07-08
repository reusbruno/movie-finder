import type { TMDBPerson } from "@/lib/tmdb";
import { ActorCard } from "@/components/actor-card";

export function ActorGrid({ people }: { people: TMDBPerson[] }) {
  if (people.length === 0) {
    return (
      <p className="py-16 text-center text-foreground/60">No actors found.</p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {people.map((person) => (
        <ActorCard key={person.id} person={person} />
      ))}
    </div>
  );
}
