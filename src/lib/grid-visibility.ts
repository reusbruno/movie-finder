// The grids render at 3/4/6/8 columns (base/sm/md/xl). TMDB's page size
// (20) doesn't divide evenly into any of those except 4, so a trailing
// partial row is common and lands on a different breakpoint depending on
// viewport. Rather than over-fetching to a common multiple (24 - the LCM
// of 3/4/6/8) just to guarantee full rows everywhere, trim the trailing
// partial row per breakpoint instead: hide only the items past the last
// complete row *at that specific column count*, never touching the count
// when there are too few items to fill even one row.
//
// Only ever call this behind MovieGrid's `trimTrailingRow` prop, and only
// pass that prop true when the hidden items remain reachable some other
// way (e.g. a "Load more" button that will eventually reveal them).
// Applying it to a one-shot, non-paginated result set silently discards
// real, already-fetched results with no way for the user to ever see
// them - that's a real bug this app shipped once already (a wide-viewport
// Popular grid quietly showing 18 of 20 fetched movies, no error, no way
// to reach the other 2), not a cosmetic nit.
// Every class name below is written out in full, never built via
// `${prefix}block`-style interpolation - Tailwind's build-time scanner only
// generates CSS for class names it can find as complete literal tokens in
// source text, so a dynamically-interpolated string can silently produce a
// className the compiled stylesheet has no rule for at all (no build
// error, just a no-op class - see https://tailwindcss.com/docs/detecting-classes-in-source-files#dynamic-class-names).
// That was a real, previously-deferred-as-cosmetic bug here: `sm:hidden`,
// `md:hidden`, and `xl:block` never happened to appear as literal tokens
// anywhere else in this codebase, so they were silently missing from the
// compiled CSS - a trailing row that should have been hidden at the md
// breakpoint stayed visible (falling back to whatever lower-breakpoint
// rule DID compile), producing an orphaned partial row instead of a clean
// trim. Confirmed directly by inspecting the compiled CSS output, not
// just theorized.
const GRID_COLUMN_BREAKPOINTS = [
  { cols: 3, visibleClass: "block", hiddenClass: "hidden" },
  { cols: 4, visibleClass: "sm:block", hiddenClass: "sm:hidden" },
  { cols: 6, visibleClass: "md:block", hiddenClass: "md:hidden" },
  { cols: 8, visibleClass: "xl:block", hiddenClass: "xl:hidden" },
] as const;

export function gridItemVisibilityClass(index: number, total: number): string {
  return GRID_COLUMN_BREAKPOINTS.map(({ cols, visibleClass, hiddenClass }) => {
    if (total <= cols) return visibleClass;
    const remainder = total % cols;
    const visibleCount = remainder === 0 ? total : total - remainder;
    return index < visibleCount ? visibleClass : hiddenClass;
  }).join(" ");
}
