import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="font-display text-2xl tracking-wide">Not found</h1>
      <p className="max-w-md text-sm text-foreground/60">
        We couldn&apos;t find what you were looking for. It may have been
        removed, or the link might be wrong.
      </p>
      <Link
        href="/movies"
        className="rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium transition-colors hover:border-foreground/30 hover:text-foreground dark:border-white/[.145]"
      >
        Back to Movies
      </Link>
    </div>
  );
}
