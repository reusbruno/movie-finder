"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="font-display text-2xl tracking-wide">
        Something went wrong
      </h1>
      <p className="max-w-md text-sm text-foreground/60">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium transition-colors hover:border-foreground/30 hover:text-foreground dark:border-white/[.145]"
      >
        Try again
      </button>
    </div>
  );
}
