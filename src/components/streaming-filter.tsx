import { STREAMING_PROVIDERS, type WatchRegion } from "@/lib/watch-providers";

export function StreamingFilter({
  region,
  selectedProviderIds,
  onToggle,
}: {
  region: WatchRegion;
  selectedProviderIds: number[];
  onToggle: (id: number) => void;
}) {
  const providers = STREAMING_PROVIDERS[region];

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium tracking-wide text-foreground/50 uppercase">
        Streaming on
      </span>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Streaming on">
        {providers.map((provider) => {
          const selected = selectedProviderIds.includes(provider.id);

          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => onToggle(provider.id)}
              aria-pressed={selected}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                selected
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-black/[.08] text-foreground/60 hover:border-foreground/30 hover:text-foreground dark:border-white/[.145]"
              }`}
            >
              {provider.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
