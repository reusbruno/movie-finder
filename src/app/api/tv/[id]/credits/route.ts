import { NextRequest, NextResponse } from "next/server";
import { getTVCredits, TMDBError } from "@/lib/tmdb";
import { TMDB_LANGUAGE } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n";
import { resolveLocale } from "@/lib/i18n/request";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tvId = Number(id);

  const resolved = resolveLocale(request.nextUrl.searchParams.get("language"));
  if (!resolved.ok) return resolved.response;
  const { locale } = resolved;

  if (!Number.isInteger(tvId) || tvId < 1) {
    return NextResponse.json(
      { error: getDictionary(locale).serverErrors.invalidTVId },
      { status: 400 }
    );
  }

  try {
    const credits = await getTVCredits(tvId, TMDB_LANGUAGE[locale]);
    // Cast only - crew (director, writers, etc.) isn't part of this feature.
    return NextResponse.json({ id: credits.id, cast: credits.cast });
  } catch (error) {
    if (error instanceof TMDBError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: getDictionary(locale).serverErrors.failedToFetchTVCredits },
      { status: 500 }
    );
  }
}
