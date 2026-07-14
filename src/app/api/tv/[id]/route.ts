import { NextRequest, NextResponse } from "next/server";
import { getTVDetails, TMDBError } from "@/lib/tmdb";
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
    const show = await getTVDetails(tvId, TMDB_LANGUAGE[locale]);
    return NextResponse.json(show);
  } catch (error) {
    if (error instanceof TMDBError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: getDictionary(locale).serverErrors.failedToFetchTVDetails },
      { status: 500 }
    );
  }
}
