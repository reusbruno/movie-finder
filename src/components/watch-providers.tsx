"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { TMDBWatchProvidersRegion } from "@/lib/tmdb";
import { WATCH_REGIONS, type WatchRegion } from "@/lib/watch-providers";
import { useWatchRegion } from "@/lib/use-watch-region";

const LOGO_BASE_URL = "https://image.tmdb.org/t/p/w92";

const CATEGORIES = [
  { key: "flatrate", label: "Stream" },
  { key: "rent", label: "Rent" },
  { key: "buy", label: "Buy" },
] as const;

export function WatchProviders({
  mediaType,
  id,
  initialRegion,
  initialData,
}: {
  mediaType: "movie" | "tv";
  id: number;
  // Server-fetched region + result for the page's first paint, so the
  // common case (region === initialRegion, i.e. no persisted override)
  // renders immediately with no client fetch or loading flash.
  initialRegion: WatchRegion;
  initialData: TMDBWatchProvidersRegion | null;
}) {
  const { region, setRegion } = useWatchRegion();
  const [data, setData] = useState(initialData);
  // Tracks which region `data` actually reflects, so a mismatch against the
  // (possibly just-changed) selected region is exactly "a fetch for the
  // new region is needed" - covers both an explicit dropdown change and a
  // returning visitor whose persisted region differs from what the server
  // guessed (always initialRegion, since the server can't read localStorage).
  const [loadedRegion, setLoadedRegion] = useState(initialRegion);

  useEffect(() => {
    if (region === loadedRegion) return;

    let cancelled = false;
    const basePath = mediaType === "movie" ? "movies" : "tv";

    fetch(`/api/${basePath}/${id}/watch-providers?region=${region}`)
      .then((response) => response.json())
      .then((json: { region?: TMDBWatchProvidersRegion | null }) => {
        if (cancelled) return;
        setData(json.region ?? null);
        setLoadedRegion(region);
      })
      .catch(() => {
        // Best-effort, same as the server-side fetch this replaces -
        // degrade to "no providers" for this region rather than getting
        // stuck retrying every render.
        if (!cancelled) {
          setData(null);
          setLoadedRegion(region);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [region, loadedRegion, mediaType, id]);

  const groups = CATEGORIES.map(({ key, label }) => ({
    label,
    providers: [...(data?.[key] ?? [])].sort(
      (a, b) => a.display_priority - b.display_priority
    ),
  })).filter((group) => group.providers.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-lg tracking-wide">Where to watch</h2>
        <select
          value={region}
          onChange={(event) => setRegion(event.target.value as WatchRegion)}
          aria-label="Region"
          className="rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-xs text-foreground outline-none focus:border-foreground/40 dark:border-white/[.145]"
        >
          {WATCH_REGIONS.map(({ code, label }) => (
            <option key={code} value={code} className="bg-background text-foreground">
              {label}
            </option>
          ))}
        </select>
        {region !== loadedRegion && (
          <span className="text-xs text-foreground/50">Loading…</span>
        )}
      </div>
      {groups.length > 0 && (
        <>
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
          {data && (
            <a
              href={data.link}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit text-xs text-foreground/60 hover:text-foreground"
            >
              More info on TMDB →
            </a>
          )}
        </>
      )}
    </div>
  );
}
