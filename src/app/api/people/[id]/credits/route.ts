import { NextResponse } from "next/server";
import { getPersonMovieCredits, TMDBError } from "@/lib/tmdb";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const personId = Number(id);

  if (!Number.isInteger(personId) || personId < 1) {
    return NextResponse.json({ error: "Invalid person id" }, { status: 400 });
  }

  try {
    const credits = await getPersonMovieCredits(personId);
    // Cast credits only - this is "movies they acted in", not a full
    // filmography including directing/writing/producing roles.
    return NextResponse.json({ id: credits.id, cast: credits.cast });
  } catch (error) {
    if (error instanceof TMDBError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Failed to fetch person credits" },
      { status: 500 }
    );
  }
}
