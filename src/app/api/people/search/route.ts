import { NextRequest, NextResponse } from "next/server";
import { searchPeople, TMDBError } from "@/lib/tmdb";
import { TMDB_LANGUAGE } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n";
import { resolveLocale } from "@/lib/i18n/request";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("query");
  const pageParam = searchParams.get("page");

  const resolved = resolveLocale(searchParams.get("language"));
  if (!resolved.ok) return resolved.response;
  const { locale } = resolved;

  if (!query || query.trim().length === 0) {
    return NextResponse.json(
      { error: "Query parameter 'query' is required" },
      { status: 400 }
    );
  }

  const page = pageParam ? Number(pageParam) : 1;
  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json(
      { error: "Query parameter 'page' must be a positive integer" },
      { status: 400 }
    );
  }

  try {
    const results = await searchPeople(query, page, TMDB_LANGUAGE[locale]);
    return NextResponse.json(results);
  } catch (error) {
    if (error instanceof TMDBError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: getDictionary(locale).serverErrors.failedToSearchPeople },
      { status: 500 }
    );
  }
}
