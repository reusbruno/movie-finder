"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/use-auth";
import { signOut } from "@/lib/auth";
import { useLanguage } from "@/components/language-provider";

export function AuthStatus() {
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/movies");
    // Server Components (the watchlist redirect check) need to
    // re-evaluate against the now-cleared session.
    router.refresh();
  }

  // Avoids a flash of "Sign in" before the session resolves on first load -
  // resolves within one render in the common case (session already
  // persisted), same tradeoff every other client-only state read in this
  // app accepts.
  if (loading) return null;

  if (!user) {
    return (
      <Link
        href="/sign-in"
        className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
      >
        {t.auth.signIn}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className="hidden max-w-[8rem] truncate text-sm text-foreground/60 sm:inline"
        title={user.email ?? undefined}
      >
        {user.email}
      </span>
      <button
        type="button"
        onClick={handleSignOut}
        className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
      >
        {t.auth.signOut}
      </button>
    </div>
  );
}
