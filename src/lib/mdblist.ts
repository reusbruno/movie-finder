const MDBLIST_API_BASE_URL = "https://api.mdblist.com";

export class MDBListError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "MDBListError";
  }
}

interface MDBListRatingEntry {
  source: string;
  value: number | string | null;
  score: number | null;
}

interface MDBListTitleResponse {
  ratings?: MDBListRatingEntry[];
}

function getApiKey(): string {
  const key = process.env.MDBLIST_API_KEY;
  if (!key) {
    throw new Error("MDBLIST_API_KEY environment variable is not set");
  }
  return key;
}

const REQUEST_TIMEOUT_MS = 10_000;
const REVALIDATE_SECONDS = 300;

async function mdblistFetch(path: string): Promise<MDBListTitleResponse> {
  const url = new URL(`${MDBLIST_API_BASE_URL}${path}`);
  url.searchParams.set("apikey", getApiKey());

  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new MDBListError(
      `MDBList request failed: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  return response.json() as Promise<MDBListTitleResponse>;
}

// Only Rotten Tomatoes is exposed here - MDBList is used solely as a
// fallback for the case OMDb's RT coverage is missing (common for TV),
// not as a general ratings source.
export async function getRottenTomatoesScore(
  imdbId: string,
  mediaType: "movie" | "tv"
): Promise<number | null> {
  const mdblistType = mediaType === "tv" ? "show" : "movie";
  const data = await mdblistFetch(`/imdb/${mdblistType}/${imdbId}`);

  const entry = data.ratings?.find((rating) => rating.source === "tomatoes");
  if (!entry || typeof entry.score !== "number") {
    return null;
  }

  return entry.score;
}
