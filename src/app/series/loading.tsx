import { SkeletonGrid, SkeletonLine } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-9 w-full max-w-md animate-pulse rounded-full bg-black/[.04] dark:bg-white/[.06]" />
      </div>
      <SkeletonLine className="w-40" />
      <SkeletonGrid />
    </div>
  );
}
