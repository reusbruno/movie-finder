import { NextRequest, NextResponse } from "next/server";
import { getMovieDetails, TMDBError } from "@/lib/tmdb";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const movieId = Number(id);

  if (!Number.isInteger(movieId) || movieId < 1) {
    return NextResponse.json({ error: "Invalid movie id" }, { status: 400 });
  }

  try {
    const movie = await getMovieDetails(movieId);
    return NextResponse.json(movie);
  } catch (error) {
    if (error instanceof TMDBError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Failed to fetch movie details" },
      { status: 500 }
    );
  }
}
