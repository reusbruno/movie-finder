import type { TMDBVideo } from "@/lib/tmdb";
import type { Locale } from "@/lib/i18n/locale";

function byRecencyDesc(a: TMDBVideo, b: TMDBVideo): number {
  return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
}

// Prefer an official trailer, most recent first; fall back to any trailer,
// then any teaser. Selection is by official/type/recency only - never by
// caption language (see buildTrailerEmbedUrl below) - audio stays the
// trailer's own original track regardless of the viewer's UI locale.
// YouTube-only: this app only knows how to embed YouTube (youtube-nocookie
// domain below), so a Vimeo-only video is treated the same as no video.
export function selectTrailer(videos: TMDBVideo[]): TMDBVideo | null {
  const youtube = videos.filter((video) => video.site === "YouTube");

  const officialTrailers = youtube
    .filter((video) => video.official && video.type === "Trailer")
    .sort(byRecencyDesc);
  if (officialTrailers[0]) return officialTrailers[0];

  const anyTrailers = youtube.filter((video) => video.type === "Trailer").sort(byRecencyDesc);
  if (anyTrailers[0]) return anyTrailers[0];

  const teasers = youtube.filter((video) => video.type === "Teaser").sort(byRecencyDesc);
  if (teasers[0]) return teasers[0];

  return null;
}

// YouTube's caption-language codes are bare ISO 639-1 ("pt", "en"), not the
// app's own "pt-BR" locale tag.
const CAPTION_LANGUAGE: Record<Locale, string> = { en: "en", "pt-BR": "pt" };

// youtube-nocookie.com: no tracking cookies are set until the viewer
// actually presses play, per the design's privacy requirement.
// cc_load_policy=1 + cc_lang_pref requests captions on by default in the
// viewer's UI language - this is a REQUEST, not a guarantee: YouTube only
// serves a caption track the video actually has, silently falling back to
// whatever it does have (or none) when the preferred language is missing.
export function buildTrailerEmbedUrl(key: string, locale: Locale): string {
  const params = new URLSearchParams({
    autoplay: "1",
    rel: "0",
    modestbranding: "1",
    cc_load_policy: "1",
    cc_lang_pref: CAPTION_LANGUAGE[locale],
  });
  return `https://www.youtube-nocookie.com/embed/${key}?${params.toString()}`;
}
