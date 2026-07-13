"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/language-provider";

export function ModeToggle() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const MODES = [
    { href: "/movies", label: t.header.movies },
    { href: "/series", label: t.header.series },
  ] as const;

  return (
    <nav
      aria-label={t.header.contentModeAriaLabel}
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
