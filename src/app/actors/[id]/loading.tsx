import { SkeletonDetailHero, SkeletonGrid, SkeletonLine } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-10 px-6 py-8">
      <SkeletonLine className="w-28" />
      <SkeletonDetailHero />
      <div className="flex flex-col gap-6">
        <SkeletonLine className="w-28" />
        <SkeletonGrid />
      </div>
    </div>
  );
}
