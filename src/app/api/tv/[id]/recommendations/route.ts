import { NextRequest, NextResponse } from "next/server";
import { getTVRecommendations, TMDBError } from "@/lib/tmdb";
import { enrichTVWithRatings } from "@/lib/ratings";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tvId = Number(id);

  if (!Number.isInteger(tvId) || tvId < 1) {
    return NextResponse.json({ error: "Invalid TV show id" }, { status: 400 });
  }

  const pageParam = request.nextUrl.searchParams.get("page");
  const page = pageParam ? Number(pageParam) : 1;

  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json(
      { error: "Query parameter 'page' must be a positive integer" },
      { status: 400 }
    );
  }

  try {
    const results = await getTVRecommendations(tvId, page);
    const enriched = await enrichTVWithRatings(results.results);
    return NextResponse.json({ ...results, results: enriched });
  } catch (error) {
    if (error instanceof TMDBError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Failed to fetch TV show recommendations" },
      { status: 500 }
    );
  }
}
