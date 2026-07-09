import { NextRequest, NextResponse } from "next/server";
import { TMDBError } from "@/lib/tmdb";
import { blendTitles, VibeBlendError } from "@/lib/vibe-blend";
import { enrichMoviesWithRatings } from "@/lib/ratings";

// blendTitles can return up to a full discover page (~20) of scored
// candidates. Enriching all of them would fire an OMDb lookup per candidate
// on every blend - cap to the top-ranked results (after scoring) instead,
// same pattern as MAX_ENRICHED_RECOMMENDATIONS on the detail pages.
const MAX_ENRICHED_BLEND_RESULTS = 10;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const idA = Number(searchParams.get("a"));
  const idB = Number(searchParams.get("b"));

  if (!Number.isInteger(idA) || idA <= 0 || !Number.isInteger(idB) || idB <= 0) {
    return NextResponse.json(
      { error: "Query parameters 'a' and 'b' must both be positive integer TMDB ids" },
      { status: 400 }
    );
  }

  try {
    const blend = await blendTitles(idA, idB, "movie");
    const topResults = blend.results.slice(0, MAX_ENRICHED_BLEND_RESULTS);
    const enriched = await enrichMoviesWithRatings(topResults);
    return NextResponse.json({
      results: enriched,
      titleA: blend.titleA,
      titleB: blend.titleB,
    });
  } catch (error) {
    if (error instanceof VibeBlendError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof TMDBError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to blend movies" }, { status: 500 });
  }
}
