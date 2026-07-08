import { SkeletonDetailHero, SkeletonGrid, SkeletonLine } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-10 px-6 py-8">
      <SkeletonLine className="w-28" />
      <SkeletonDetailHero />
      <div className="flex flex-col gap-4">
        <SkeletonLine className="w-16" />
        <SkeletonGrid count={12} />
      </div>
      <div className="flex flex-col gap-4">
        <SkeletonLine className="w-36" />
        <SkeletonGrid count={8} />
      </div>
    </div>
  );
}
