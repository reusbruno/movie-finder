import Image from "next/image";
import type { TMDBWatchProvidersRegion } from "@/lib/tmdb";

const LOGO_BASE_URL = "https://image.tmdb.org/t/p/w92";

const CATEGORIES = [
  { key: "flatrate", label: "Stream" },
  { key: "rent", label: "Rent" },
  { key: "buy", label: "Buy" },
] as const;

export function WatchProviders({
  region,
}: {
  region: TMDBWatchProvidersRegion | null;
}) {
  if (!region) return null;

  const groups = CATEGORIES.map(({ key, label }) => ({
    label,
    providers: [...(region[key] ?? [])].sort(
      (a, b) => a.display_priority - b.display_priority
    ),
  })).filter((group) => group.providers.length > 0);

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-lg tracking-wide">Where to watch</h2>
      <div className="flex flex-col gap-2">
        {groups.map((group) => (
          <div key={group.label} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-12 shrink-0 text-foreground/60">{group.label}</span>
            {group.providers.map((provider) => (
              <span
                key={provider.provider_id}
                className="flex items-center gap-1.5 rounded-full bg-black/[.04] px-2 py-1 dark:bg-white/[.06]"
                title={provider.provider_name}
              >
                <Image
                  src={`${LOGO_BASE_URL}${provider.logo_path}`}
                  alt=""
                  width={20}
                  height={20}
                  className="rounded"
                />
                {provider.provider_name}
              </span>
            ))}
          </div>
        ))}
      </div>
      <a
        href={region.link}
        target="_blank"
        rel="noopener noreferrer"
        className="w-fit text-xs text-foreground/60 hover:text-foreground"
      >
        More info on TMDB →
      </a>
    </div>
  );
}
