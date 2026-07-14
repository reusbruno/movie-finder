"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Play, X } from "lucide-react";
import { buildTrailerEmbedUrl } from "@/lib/trailer";
import type { Locale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n";

// Only rendered by the caller when a trailer was actually found (see
// movies/[id]/page.tsx and series/[id]/page.tsx) - no trailer means no
// button and an unchanged poster, same graceful-absence pattern as this
// app's "-" ratings and empty watch-providers sections.
//
// Deliberately reads `getDictionary(locale)` off the `locale` prop instead
// of `useLanguage()`'s client Context - this component already needs
// `locale` as a real, meaningful value for the trailer's own caption
// preference (buildTrailerEmbedUrl below), so its aria-label text must
// stay consistent with that same resolved locale rather than the client's
// own toggle state, which can differ from it (e.g. an explicit `?lang=en`
// override viewed while the client's own persisted preference is pt-BR).
export function TrailerButton({
  videoKey,
  title,
  locale,
}: {
  videoKey: string;
  title: string;
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const [open, setOpen] = useState(false);

  // Only registered while the modal is actually open - Escape shouldn't do
  // anything else on this page, and there's nothing to clean up when it's
  // closed since the listener was never added.
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.trailer.playAriaLabel(title)}
        className="group absolute inset-0 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/20 focus-visible:bg-black/20"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-transform group-hover:scale-110 group-focus-visible:scale-110">
          <Play className="h-5 w-5 translate-x-0.5" fill="currentColor" />
        </span>
      </button>

      {open &&
        createPortal(
          // Unmounted (not just hidden) on close via the `open &&` guard
          // above, so the iframe - and any audio it's playing - is fully
          // torn down, not just visually hidden behind the backdrop.
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="relative aspect-video w-full max-w-3xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t.trailer.closeAriaLabel}
                className="absolute -top-10 right-0 text-white/80 transition-colors hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
              <iframe
                src={buildTrailerEmbedUrl(videoKey, locale)}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full rounded-lg"
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
