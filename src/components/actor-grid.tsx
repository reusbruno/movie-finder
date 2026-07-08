import type { TMDBPerson } from "@/lib/tmdb";
import { ActorCard } from "@/components/actor-card";
import { gridItemVisibilityClass } from "@/lib/grid-visibility";

export function ActorGrid({ people }: { people: TMDBPerson[] }) {
  if (people.length === 0) {
    return (
      <p className="py-16 text-center text-foreground/60">No actors found.</p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
      {people.map((person, index) => (
        <div
          key={person.id}
          className={gridItemVisibilityClass(index, people.length)}
        >
          <ActorCard person={person} />
        </div>
      ))}
    </div>
  );
}
