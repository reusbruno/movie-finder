import { NextRequest, NextResponse } from "next/server";
import { TMDBError } from "@/lib/tmdb";
import { blendTitles, VibeBlendError } from "@/lib/vibe-blend";
import { enrichMoviesWithRatings } from "@/lib/ratings";
import { TMDB_LANGUAGE } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n";
import { resolveLocale } from "@/lib/i18n/request";

// blendTitles can return up to a full discover page (~20) of scored
// candidates. Enriching all of them would fire an OMDb lookup per candidate
// on every blend - cap to the top-ranked results (after scoring) instead,
// same pattern as MAX_ENRICHED_RECOMMENDATIONS on the detail pages.
const MAX_ENRICHED_BLEND_RESULTS = 10;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const idA = Number(searchParams.get("a"));
  const idB = Number(searchParams.get("b"));
  const pageParam = searchParams.get("page");

  const resolved = resolveLocale(searchParams.get("language"));
  if (!resolved.ok) return resolved.response;
  const { locale } = resolved;

  if (!Number.isInteger(idA) || idA <= 0 || !Number.isInteger(idB) || idB <= 0) {
    return NextResponse.json(
      { error: "Query parameters 'a' and 'b' must both be positive integer TMDB ids" },
      { status: 400 }
    );
  }

  // Which MAX_ENRICHED_BLEND_RESULTS-sized slice of the already-scored pool
  // to return - blendTitles' own candidate pool is a single TMDB discover
  // page (~20 titles minus the two seeds), already fully scored and sorted
  // in one call, so Load More just asks for a later slice of the SAME pool
  // rather than deepening the discover fetch or re-scoring.
  let page = 1;
  if (pageParam !== null) {
    page = Number(pageParam);
    if (!Number.isInteger(page) || page < 1) {
      return NextResponse.json(
        { error: "Query parameter 'page' must be a positive integer" },
        { status: 400 }
      );
    }
  }

  try {
    const blend = await blendTitles(idA, idB, "movie", TMDB_LANGUAGE[locale]);
    const start = (page - 1) * MAX_ENRICHED_BLEND_RESULTS;
    const topResults = blend.results.slice(start, start + MAX_ENRICHED_BLEND_RESULTS);
    const enriched = await enrichMoviesWithRatings(topResults);
    return NextResponse.json({
      results: enriched,
      titleA: blend.titleA,
      titleB: blend.titleB,
      hasMore: start + MAX_ENRICHED_BLEND_RESULTS < blend.results.length,
    });
  } catch (error) {
    if (error instanceof VibeBlendError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof TMDBError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: getDictionary(locale).serverErrors.failedToBlendMovies },
      { status: 500 }
    );
  }
}
