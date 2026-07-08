import { NextRequest, NextResponse } from "next/server";
import { TMDBError } from "@/lib/tmdb";
import { blendTitles, VibeBlendError } from "@/lib/vibe-blend";
import { enrichMoviesWithRatings } from "@/lib/ratings";

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
    const enriched = await enrichMoviesWithRatings(blend.results);
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
