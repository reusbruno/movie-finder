import { NextRequest, NextResponse } from "next/server";
import { searchTV, TMDBError } from "@/lib/tmdb";
import { enrichTVWithRatings } from "@/lib/ratings";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("query");
  const pageParam = searchParams.get("page");

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
    const results = await searchTV(query, page);
    const enriched = await enrichTVWithRatings(results.results);
    return NextResponse.json({ ...results, results: enriched });
  } catch (error) {
    if (error instanceof TMDBError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Failed to search TV shows" },
      { status: 500 }
    );
  }
}
