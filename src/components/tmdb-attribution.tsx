export function TmdbAttribution() {
  return (
    <footer className="border-t border-black/[.08] px-6 py-4 dark:border-white/[.145]">
      <div className="flex flex-wrap items-center gap-3 text-xs text-foreground/50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/tmdb-logo.svg"
          alt="The Movie Database (TMDB) logo"
          className="h-4 w-auto shrink-0"
        />
        <p>
          This product uses the TMDB API but is not endorsed or certified by
          TMDB.
        </p>
      </div>
    </footer>
  );
}
