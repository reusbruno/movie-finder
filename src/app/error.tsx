"use client";

import { useEffect } from "react";
import { useLanguage } from "@/components/language-provider";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLanguage();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="font-display text-2xl tracking-wide">
        {t.errorPage.heading}
      </h1>
      <p className="max-w-md text-sm text-foreground/60">
        {error.message || t.errorPage.defaultMessage}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium transition-colors hover:border-foreground/30 hover:text-foreground dark:border-white/[.145]"
      >
        {t.common.tryAgain}
      </button>
    </div>
  );
}
