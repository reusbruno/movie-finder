import { NextResponse } from "next/server";
import { getTVGenres, TMDBError } from "@/lib/tmdb";

export async function GET() {
  try {
    const genres = await getTVGenres();
    return NextResponse.json(genres);
  } catch (error) {
    if (error instanceof TMDBError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Failed to fetch TV genres" },
      { status: 500 }
    );
  }
}
