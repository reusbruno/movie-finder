import { NextRequest, NextResponse } from "next/server";
import { TMDBError } from "@/lib/tmdb";
import {
  DEFAULT_WATCH_REGION,
  getTVWatchProviders,
  isWatchRegion,
  WATCH_REGIONS,
} from "@/lib/watch-providers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tvId = Number(id);

  if (!Number.isInteger(tvId) || tvId < 1) {
    return NextResponse.json({ error: "Invalid TV show id" }, { status: 400 });
  }

  const regionParam = request.nextUrl.searchParams.get("region");
  if (regionParam && !isWatchRegion(regionParam)) {
    return NextResponse.json(
      {
        error: `Query parameter 'region' must be one of: ${WATCH_REGIONS.map((r) => r.code).join(", ")}`,
      },
      { status: 400 }
    );
  }
  const region = regionParam && isWatchRegion(regionParam) ? regionParam : DEFAULT_WATCH_REGION;

  try {
    const providers = await getTVWatchProviders(tvId, region);
    return NextResponse.json({ region: providers });
  } catch (error) {
    if (error instanceof TMDBError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Failed to fetch watch providers" },
      { status: 500 }
    );
  }
}
