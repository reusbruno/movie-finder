const PULSE = "animate-pulse rounded-lg bg-black/[.04] dark:bg-white/[.06]";

export function SkeletonGrid({ count = 20 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={`aspect-[2/3] ${PULSE}`} />
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
