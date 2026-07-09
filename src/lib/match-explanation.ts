import { getMovieKeywordList, getTVKeywordList } from "@/lib/keywords";
import type { TMDBMovie } from "@/lib/tmdb";
import type { MovieWithRatings } from "@/lib/ratings";

export type MediaType = "movie" | "tv";

// A shared trait's weight is doubled (genre) or quadrupled (keyword) when it
// belongs to both blend seeds rather than one - keywords outweigh genres
// because genres are coarse (~19 possible values) while keywords are
// specific, so a shared keyword is stronger evidence of a shared vibe. Same
// weights vibe-blend.ts's scoring used before this feature - reused here so
// ranking and "why this match" always agree on what mattered.
export const GENRE_POINTS_ONE = 1;
export const GENRE_POINTS_BOTH = 2;
export const KEYWORD_POINTS_ONE = 2;
export const KEYWORD_POINTS_BOTH = 4;

const MAX_SIGNALS_SHOWN = 2;

export interface MatchSignal {
  type: "genre" | "keyword";
  name: string;
  weight: number;
  attachedTo: "both" | "a" | "b";
}

export type MovieWithMatch = MovieWithRatings & { matchExplanation?: string | null };

// --- Blend (two reference titles) ---------------------------------------

export function computeBlendSignals(
  candidateGenreIds: number[],
  candidateKeywordIds: Set<number>,
  genreNamesA: Map<number, string>,
  genreNamesB: Map<number, string>,
  keywordNamesA: Map<number, string>,
  keywordNamesB: Map<number, string>
): MatchSignal[] {
  const signals: MatchSignal[] = [];

  for (const genreId of candidateGenreIds) {
    const inA = genreNamesA.has(genreId);
    const inB = genreNamesB.has(genreId);
    if (!inA && !inB) continue;
    signals.push({
      type: "genre",
      name: (genreNamesA.get(genreId) ?? genreNamesB.get(genreId))!,
      weight: inA && inB ? GENRE_POINTS_BOTH : GENRE_POINTS_ONE,
      attachedTo: inA && inB ? "both" : inA ? "a" : "b",
    });
  }

  for (const keywordId of candidateKeywordIds) {
    const inA = keywordNamesA.has(keywordId);
    const inB = keywordNamesB.has(keywordId);
    if (!inA && !inB) continue;
    signals.push({
      type: "keyword",
      name: (keywordNamesA.get(keywordId) ?? keywordNamesB.get(keywordId))!,
      weight: inA && inB ? KEYWORD_POINTS_BOTH : KEYWORD_POINTS_ONE,
      attachedTo: inA && inB ? "both" : inA ? "a" : "b",
    });
  }

  // Highest weight first; "both" outranks "one" on a tie - a genre shared
  // by both seeds is a more interesting story for a blend than a keyword
  // that only happens to land on one side, even at equal point value.
  signals.sort((x, y) => {
    if (y.weight !== x.weight) return y.weight - x.weight;
    if (x.attachedTo === "both" && y.attachedTo !== "both") return -1;
    if (y.attachedTo === "both" && x.attachedTo !== "both") return 1;
    return 0;
  });

  return signals;
}

export function blendSignalScore(signals: MatchSignal[]): number {
  return signals.reduce((sum, signal) => sum + signal.weight, 0);
}

export function explainBlendMatch(
  signals: MatchSignal[],
  titleA: string,
  titleB: string,
  inRecA: boolean,
  inRecB: boolean
): string | null {
  const top = signals.slice(0, MAX_SIGNALS_SHOWN);

  if (top.length === 0) {
    if (inRecA && inRecB) {
      return `Recommended alongside both ${titleA} and ${titleB}.`;
    }
    return null;
  }

  const bothNames = top.filter((s) => s.attachedTo === "both").map((s) => s.name);
  const aNames = top.filter((s) => s.attachedTo === "a").map((s) => s.name);
  const bNames = top.filter((s) => s.attachedTo === "b").map((s) => s.name);

  if (bothNames.length === top.length) {
    return `Shares ${bothNames.join(" and ")} with both ${titleA} and ${titleB}.`;
  }

  if (bothNames.length > 0) {
    const restIsA = aNames.length > 0;
    const rest = restIsA ? aNames[0] : bNames[0];
    const restTitle = restIsA ? titleA : titleB;
    return `Shares ${bothNames[0]} with both ${titleA} and ${titleB} — also ${rest} (${restTitle}).`;
  }

  if (aNames.length > 0 && bNames.length > 0) {
    return `Connects to ${titleA} through ${aNames[0]} and ${titleB} through ${bNames[0]}.`;
  }

  if (aNames.length > 0) {
    return `Shares ${aNames.join(", ")} with ${titleA}.`;
  }

  return `Shares ${bNames.join(", ")} with ${titleB}.`;
}

// --- Single reference (mood search / one detail-page title) -------------

export function computeMatchSignals(
  candidateGenreIds: number[],
  candidateKeywordIds: Set<number>,
  genreNames: Map<number, string>,
  keywordNames: Map<number, string>
): MatchSignal[] {
  const signals: MatchSignal[] = [];

  for (const genreId of candidateGenreIds) {
    const name = genreNames.get(genreId);
    if (!name) continue;
    signals.push({ type: "genre", name, weight: GENRE_POINTS_ONE, attachedTo: "a" });
  }
  for (const keywordId of candidateKeywordIds) {
    const name = keywordNames.get(keywordId);
    if (!name) continue;
    signals.push({ type: "keyword", name, weight: KEYWORD_POINTS_ONE, attachedTo: "a" });
  }

  return signals;
}

// Prefers one genre + one keyword (when both exist) over pure weight order -
// an all-keyword pair reads thinner without a genre for context, and genres
// alone read thinner without the more specific keyword.
function pickBalancedTop(signals: MatchSignal[]): MatchSignal[] {
  const genres = signals.filter((s) => s.type === "genre");
  const keywords = signals.filter((s) => s.type === "keyword");

  if (genres.length > 0 && keywords.length > 0) {
    return [genres[0], keywords[0]];
  }
  return signals.slice(0, MAX_SIGNALS_SHOWN);
}

export function explainSingleRefMatch(
  signals: MatchSignal[],
  referenceTitle: string
): string | null {
  const top = pickBalancedTop(signals);
  if (top.length === 0) return null;
  return `Shares ${top.map((s) => s.name).join(", ")} with ${referenceTitle}.`;
}

export function explainMoodMatch(signals: MatchSignal[]): string | null {
  const top = pickBalancedTop(signals);
  if (top.length === 0) return null;
  return `Matches ${top.map((s) => s.name).join(", ")}.`;
}

// --- Shared per-candidate attachment (mood search + single-title recs) --

// Fetches each candidate's own keywords (via the shared cache) and attaches
// a deterministic matchExplanation, using `explain` to render the final
// string from the computed signals. Best-effort: a candidate whose keyword
// lookup fails just gets a genre-only (or no) explanation, never an error.
export async function attachMatchExplanations<T extends TMDBMovie>(
  candidates: T[],
  mediaType: MediaType,
  genreNames: Map<number, string>,
  keywordNames: Map<number, string>,
  explain: (signals: MatchSignal[]) => string | null
): Promise<(T & { matchExplanation: string | null })[]> {
  const getKeywords = mediaType === "movie" ? getMovieKeywordList : getTVKeywordList;

  const candidateKeywordSets = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        const keywords = await getKeywords(candidate.id);
        return new Set(keywords.map((keyword) => keyword.id));
      } catch {
        return new Set<number>();
      }
    })
  );

  return candidates.map((candidate, index) => {
    const signals = computeMatchSignals(
      candidate.genre_ids,
      candidateKeywordSets[index],
      genreNames,
      keywordNames
    );
    return { ...candidate, matchExplanation: explain(signals) };
  });
}
