import { NextResponse } from "next/server";
import { isLocale, DEFAULT_LOCALE, type Locale } from "./locale";
import { getDictionary } from "./index";

// Shared by every API route that accepts a `language` field (query param on
// GET, body field on POST) - not re-exported from ./index.ts since it pulls
// in `next/server`, which client components must never import. Absent is
// fine (falls back to DEFAULT_LOCALE, same as a first-time visitor); present
// but invalid is a 400, same strictness the other request-shape validators
// in these routes already use (region, sort_by, etc.).
export function resolveLocale(
  raw: string | null | undefined
): { ok: true; locale: Locale } | { ok: false; response: NextResponse } {
  if (raw && !isLocale(raw)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: getDictionary(DEFAULT_LOCALE).serverErrors.unsupportedLanguage },
        { status: 400 }
      ),
    };
  }
  return { ok: true, locale: raw && isLocale(raw) ? raw : DEFAULT_LOCALE };
}
