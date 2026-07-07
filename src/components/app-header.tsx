import Link from "next/link";
import { ModeToggle } from "@/components/mode-toggle";

export function AppHeader() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-black/[.08] px-6 py-4 dark:border-white/[.145]">
      <Link href="/movies" className="text-lg font-semibold tracking-tight">
        Movie Finder
      </Link>
      <ModeToggle />
    </header>
  );
}
