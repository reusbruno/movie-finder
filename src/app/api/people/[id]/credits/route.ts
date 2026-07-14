import { NextRequest, NextResponse } from "next/server";
import { getPersonMovieCredits, TMDBError } from "@/lib/tmdb";
import { TMDB_LANGUAGE } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n";
import { resolveLocale } from "@/lib/i18n/request";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const personId = Number(id);

  const resolved = resolveLocale(request.nextUrl.searchParams.get("language"));
  if (!resolved.ok) return resolved.response;
  const { locale } = resolved;

  if (!Number.isInteger(personId) || personId < 1) {
    return NextResponse.json(
      { error: getDictionary(locale).serverErrors.invalidPersonId },
      { status: 400 }
    );
  }

  try {
    const credits = await getPersonMovieCredits(personId, TMDB_LANGUAGE[locale]);
    // Cast credits only - this is "movies they acted in", not a full
    // filmography including directing/writing/producing roles.
    return NextResponse.json({ id: credits.id, cast: credits.cast });
  } catch (error) {
    if (error instanceof TMDBError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: getDictionary(locale).serverErrors.failedToFetchPersonCredits },
      { status: 500 }
    );
  }
}
