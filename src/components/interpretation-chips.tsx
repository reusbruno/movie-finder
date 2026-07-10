// Display-only pills for mood search's resolved genres/keywords/year-range -
// upgrades the old plain "Interpreted as: a, b, c" text line into
// individually-legible chips. Non-interactive by design for now (no
// per-chip remove) - "Clear" resets the whole mood search, same as before.
export function InterpretationChips({
  labels,
  onClear,
}: {
  labels: string[];
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium tracking-wide text-foreground/50 uppercase">
        Interpreted as
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {labels.length === 0 ? (
          <span className="text-xs text-foreground/50">No specific filters</span>
        ) : (
          labels.map((label) => (
            <span
              key={label}
              className="inline-flex items-center rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium text-foreground/60 dark:border-white/[.145]"
            >
              {label}
            </span>
          ))
        )}
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-foreground/50 underline hover:text-foreground"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
