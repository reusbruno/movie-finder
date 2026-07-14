import { gridItemVisibilityClass } from "@/lib/grid-visibility";

const PULSE = "animate-pulse rounded-lg bg-black/[.04] dark:bg-white/[.06]";

export function SkeletonGrid({
  count = 20,
  // Mirrors MovieGrid's own prop of the same name and same default (false)
  // - only set true where the grid it's standing in for will itself be
  // trimmed once real results land (see media-explorer.tsx's resultsPending
  // branch), so the loading and settled states share the same clean-edge
  // row count instead of the skeleton briefly showing a full/ragged last
  // row that then snaps to a shorter trimmed one. Detail-page/actor loading
  // skeletons (fixed counts, no pagination) intentionally leave this off.
  trimTrailingRow = false,
}: {
  count?: number;
  trimTrailingRow?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={
            trimTrailingRow ? gridItemVisibilityClass(index, count) : undefined
          }
        >
          <div className={`aspect-[2/3] ${PULSE}`} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`h-4 ${PULSE} ${className}`} />;
}

export function SkeletonDetailHero() {
  return (
    <div className="flex flex-col gap-6 sm:flex-row">
      <div className={`aspect-[2/3] w-full max-w-[220px] shrink-0 ${PULSE}`} />
      <div className="flex flex-1 flex-col gap-3 pt-1">
        <SkeletonLine className="h-7 w-2/3" />
        <SkeletonLine className="w-1/4" />
        <SkeletonLine className="mt-2 h-20 w-full max-w-2xl" />
      </div>
    </div>
  );
}
