import { NextRequest, NextResponse } from "next/server";
import { getTVDetails, TMDBError } from "@/lib/tmdb";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tvId = Number(id);

  if (!Number.isInteger(tvId) || tvId < 1) {
    return NextResponse.json({ error: "Invalid TV show id" }, { status: 400 });
  }

  try {
    const show = await getTVDetails(tvId);
    return NextResponse.json(show);
  } catch (error) {
    if (error instanceof TMDBError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Failed to fetch TV show details" },
      { status: 500 }
    );
  }
}
