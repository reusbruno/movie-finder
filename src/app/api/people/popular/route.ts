import { NextRequest, NextResponse } from "next/server";
import { getPopularPeople, TMDBError } from "@/lib/tmdb";
import { TMDB_LANGUAGE } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n";
import { resolveLocale } from "@/lib/i18n/request";

export async function GET(request: NextRequest) {
  const resolved = resolveLocale(request.nextUrl.searchParams.get("language"));
  if (!resolved.ok) return resolved.response;
  const { locale } = resolved;

  const pageParam = request.nextUrl.searchParams.get("page");
  const page = pageParam ? Number(pageParam) : 1;

  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json(
      { error: "Query parameter 'page' must be a positive integer" },
      { status: 400 }
    );
  }

  try {
    const results = await getPopularPeople(page, TMDB_LANGUAGE[locale]);
    return NextResponse.json(results);
  } catch (error) {
    if (error instanceof TMDBError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: getDictionary(locale).serverErrors.failedToFetchPopularPeople },
      { status: 500 }
    );
  }
}
