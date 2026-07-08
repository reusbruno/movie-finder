"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MODES = [
  { href: "/movies", label: "Movies" },
  { href: "/series", label: "Series" },
] as const;

export function ModeToggle() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Content mode"
      className="inline-flex rounded-full border border-black/[.08] p-1 dark:border-white/[.145]"
    >
      {MODES.map(({ href, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-accent text-accent-foreground"
                : "text-foreground/70 hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
