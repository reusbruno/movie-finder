import { NextResponse } from "next/server";
import { getMovieCredits, TMDBError } from "@/lib/tmdb";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const movieId = Number(id);

  if (!Number.isInteger(movieId) || movieId < 1) {
    return NextResponse.json({ error: "Invalid movie id" }, { status: 400 });
  }

  try {
    const credits = await getMovieCredits(movieId);
    // Cast only - crew (director, writers, etc.) isn't part of this feature.
    return NextResponse.json({ id: credits.id, cast: credits.cast });
  } catch (error) {
    if (error instanceof TMDBError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Failed to fetch movie credits" },
      { status: 500 }
    );
  }
}
