import { NextRequest, NextResponse } from "next/server";
import { getMovieDetails, TMDBError } from "@/lib/tmdb";
import { TMDB_LANGUAGE } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n";
import { resolveLocale } from "@/lib/i18n/request";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const movieId = Number(id);

  const resolved = resolveLocale(request.nextUrl.searchParams.get("language"));
  if (!resolved.ok) return resolved.response;
  const { locale } = resolved;

  if (!Number.isInteger(movieId) || movieId < 1) {
    return NextResponse.json(
      { error: getDictionary(locale).serverErrors.invalidMovieId },
      { status: 400 }
    );
  }

  try {
    const movie = await getMovieDetails(movieId, TMDB_LANGUAGE[locale]);
    return NextResponse.json(movie);
  } catch (error) {
    if (error instanceof TMDBError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: getDictionary(locale).serverErrors.failedToFetchMovieDetails },
      { status: 500 }
    );
  }
}
