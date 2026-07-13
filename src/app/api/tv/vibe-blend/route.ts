import { NextRequest, NextResponse } from "next/server";
import { TMDBError } from "@/lib/tmdb";
import { blendTitles, VibeBlendError } from "@/lib/vibe-blend";
import { enrichTVWithRatings } from "@/lib/ratings";

// See src/app/api/movies/vibe-blend/route.ts - same rationale.
const MAX_ENRICHED_BLEND_RESULTS = 10;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const idA = Number(searchParams.get("a"));
  const idB = Number(searchParams.get("b"));
  const pageParam = searchParams.get("page");

  if (!Number.isInteger(idA) || idA <= 0 || !Number.isInteger(idB) || idB <= 0) {
    return NextResponse.json(
      { error: "Query parameters 'a' and 'b' must both be positive integer TMDB ids" },
      { status: 400 }
    );
  }

  // See src/app/api/movies/vibe-blend/route.ts - same rationale.
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
    const blend = await blendTitles(idA, idB, "tv");
    const start = (page - 1) * MAX_ENRICHED_BLEND_RESULTS;
    const topResults = blend.results.slice(start, start + MAX_ENRICHED_BLEND_RESULTS);
    const enriched = await enrichTVWithRatings(topResults);
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
    return NextResponse.json({ error: "Failed to blend TV shows" }, { status: 500 });
  }
}
