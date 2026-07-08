// The grids render at 3/4/6/8 columns (base/sm/md/xl). TMDB's page size
// (20) doesn't divide evenly into any of those except 4, so a trailing
// partial row is common and lands on a different breakpoint depending on
// viewport. Rather than over-fetching to a common multiple (24 - the LCM
// of 3/4/6/8) just to guarantee full rows everywhere, trim the trailing
// partial row per breakpoint instead: hide only the items past the last
// complete row *at that specific column count*, never touching the count
// when there are too few items to fill even one row.
const GRID_COLUMN_BREAKPOINTS = [
  { cols: 3, prefix: "" },
  { cols: 4, prefix: "sm:" },
  { cols: 6, prefix: "md:" },
  { cols: 8, prefix: "xl:" },
] as const;

export function gridItemVisibilityClass(index: number, total: number): string {
  return GRID_COLUMN_BREAKPOINTS.map(({ cols, prefix }) => {
    if (total <= cols) return `${prefix}block`;
    const remainder = total % cols;
    const visibleCount = remainder === 0 ? total : total - remainder;
    return index < visibleCount ? `${prefix}block` : `${prefix}hidden`;
  }).join(" ");
}
