"use client";

import { useToast } from "@/lib/use-toast";
import { dismissToast } from "@/lib/toast";

// Mounted once in the root layout (alongside LanguageProvider/AppHeader) -
// `position: fixed` here already escapes normal flow relative to the
// viewport since nothing between it and the root has a transform/
// overflow-hidden ancestor, so no portal is needed (unlike TrailerButton's
// modal, which lives deep inside an `overflow-hidden` poster wrapper and
// genuinely needs one).
export function ToastContainer() {
  const toast = useToast();
  if (!toast) return null;

  return (
    // top-24 clears the header (measured 79-87px tall across every
    // breakpoint, from a 320px phone up through desktop) with a small
    // consistent margin, rather than sitting right at the viewport edge
    // and overlapping it - confirmed live, the header's own controls were
    // genuinely unreadable/unclickable under the toast at top-4.
    <div className="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center px-4">
      <button
        type="button"
        onClick={dismissToast}
        role="status"
        aria-live="polite"
        className={`pointer-events-auto rounded-full px-4 py-2 text-sm font-medium shadow-lg backdrop-blur-sm transition-opacity hover:opacity-90 ${
          toast.variant === "error"
            ? "bg-red-600/95 text-white"
            : "bg-foreground text-background"
        }`}
      >
        {toast.message}
      </button>
    </div>
  );
}
