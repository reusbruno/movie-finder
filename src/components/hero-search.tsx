"use client";

import { Shuffle, Sparkles, SlidersHorizontal } from "lucide-react";
import { TitlePicker, type PickedTitle } from "@/components/title-picker";

// The one deliberately loud element on the browse page: centered heading,
// a single primary (gold) button for whichever action currently occupies
// this slot - Find by default, Blend when swapped into blend view. Gold is
// a per-state invariant ("the primary action right now"), not tied to a
// specific button, so this still holds "exactly one gold button on
// screen" even though two different buttons can appear here over time.
const PRIMARY_BUTTON_CLASS =
  "rounded-full bg-accent px-6 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

const QUIET_ENTRY_CLASS =
  "inline-flex items-center gap-1.5 text-xs text-foreground/60 transition-colors hover:text-foreground";

export function HeroSearch({
  heroView,
  onSwitchToBlend,
  onBackToMood,
  moodInput,
  onMoodInputChange,
  onSubmitMood,
  moodAvailable,
  moodLoading,
  moodRateLimitMessage,
  searchEndpoint,
  blendTitleA,
  blendTitleB,
  onSelectBlendA,
  onClearBlendA,
  onSelectBlendB,
  onClearBlendB,
  onSubmitBlend,
  blendLoading,
  onSurpriseMe,
  surpriseLoading,
  onToggleFilters,
  filtersRevealed,
  filtersBadgeCount,
}: {
  heroView: "mood" | "blend";
  onSwitchToBlend: () => void;
  onBackToMood: () => void;
  moodInput: string;
  onMoodInputChange: (value: string) => void;
  onSubmitMood: () => void;
  moodAvailable: boolean | null;
  moodLoading: boolean;
  moodRateLimitMessage: string | null;
  searchEndpoint: string;
  blendTitleA: PickedTitle | null;
  blendTitleB: PickedTitle | null;
  onSelectBlendA: (title: PickedTitle) => void;
  onClearBlendA: () => void;
  onSelectBlendB: (title: PickedTitle) => void;
  onClearBlendB: () => void;
  onSubmitBlend: () => void;
  blendLoading: boolean;
  onSurpriseMe: () => void;
  surpriseLoading: boolean;
  onToggleFilters: () => void;
  filtersRevealed: boolean;
  filtersBadgeCount: number;
}) {
  const blendDuplicate =
    blendTitleA !== null && blendTitleB !== null && blendTitleA.id === blendTitleB.id;
  const blendDisabled = !blendTitleA || !blendTitleB || blendDuplicate;

  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <h1 className="font-display text-xl tracking-wide">
        What are you in the mood for?
      </h1>

      {heroView === "mood" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitMood();
          }}
          className="flex w-full max-w-md flex-wrap items-center justify-center gap-2"
        >
          <input
            type="text"
            value={moodInput}
            onChange={(event) => onMoodInputChange(event.target.value)}
            placeholder="Describe a mood… e.g. slow melancholic sci-fi"
            aria-label="Mood search"
            disabled={!moodAvailable}
            className="min-w-0 flex-1 rounded-full border border-black/[.08] bg-transparent px-4 py-2 text-sm outline-none focus:border-foreground/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.145]"
          />
          <button
            type="submit"
            disabled={!moodAvailable || !moodInput.trim()}
            className={PRIMARY_BUTTON_CLASS}
          >
            {moodLoading ? "Thinking…" : "Find"}
          </button>
        </form>
      ) : (
        <div className="flex w-full max-w-md flex-col items-center gap-2">
          <div className="flex w-full flex-wrap items-center justify-center gap-2">
            <TitlePicker
              searchEndpoint={searchEndpoint}
              placeholder="First title…"
              selected={blendTitleA}
              onSelect={onSelectBlendA}
              onClear={onClearBlendA}
            />
            <span className="text-sm text-foreground/50">+</span>
            <TitlePicker
              searchEndpoint={searchEndpoint}
              placeholder="Second title…"
              selected={blendTitleB}
              onSelect={onSelectBlendB}
              onClear={onClearBlendB}
            />
            <button
              type="button"
              onClick={onSubmitBlend}
              disabled={blendDisabled}
              className={PRIMARY_BUTTON_CLASS}
            >
              {blendLoading ? "Blending…" : "Blend"}
            </button>
          </div>
          {blendDuplicate && (
            <p className="text-xs text-foreground/50">Pick two different titles to blend</p>
          )}
          <button type="button" onClick={onBackToMood} className="text-xs text-foreground/50 underline">
            ← Mood search
          </button>
        </div>
      )}

      {moodAvailable === false && heroView === "mood" && (
        <p className="text-xs text-foreground/50">Mood search — coming soon</p>
      )}
      {moodRateLimitMessage && heroView === "mood" && (
        <p className="text-xs text-foreground/50">{moodRateLimitMessage}</p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-5">
        <button type="button" onClick={onSwitchToBlend} className={QUIET_ENTRY_CLASS}>
          <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
          Blend two titles
        </button>
        <button
          type="button"
          onClick={onSurpriseMe}
          disabled={surpriseLoading}
          className={`${QUIET_ENTRY_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {surpriseLoading ? "Picking…" : "Surprise me"}
        </button>
        <button type="button" onClick={onToggleFilters} className={QUIET_ENTRY_CLASS}>
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          Browse with filters
          {!filtersRevealed && filtersBadgeCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
              {filtersBadgeCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
