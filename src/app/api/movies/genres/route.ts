import { NextRequest, NextResponse } from "next/server";
import { getMovieGenres, TMDBError } from "@/lib/tmdb";
import { TMDB_LANGUAGE } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n";
import { resolveLocale } from "@/lib/i18n/request";

export async function GET(request: NextRequest) {
  const resolved = resolveLocale(request.nextUrl.searchParams.get("language"));
  if (!resolved.ok) return resolved.response;
  const { locale } = resolved;

  try {
    const genres = await getMovieGenres(TMDB_LANGUAGE[locale]);
    return NextResponse.json(genres);
  } catch (error) {
    if (error instanceof TMDBError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: getDictionary(locale).serverErrors.failedToFetchGenres },
      { status: 500 }
    );
  }
}
