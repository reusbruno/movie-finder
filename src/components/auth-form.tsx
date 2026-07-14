"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/language-provider";

type Mode = "sign-in" | "sign-up";

const FIELD_CLASS =
  "rounded-full border border-black/[.08] bg-transparent px-4 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/[.145]";

export function AuthForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/movies";

  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Supabase's own error messages ("Invalid login credentials", etc.) come
  // back in English regardless of the app's locale - passed through as-is
  // rather than built into a translated mapping table, which would need
  // to track every message Supabase's Auth API can return.
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();
    const { error: authError } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (authError) {
      setError(authError.message);
      setSubmitting(false);
      return;
    }

    router.push(next);
    // Server Components (e.g. the watchlist redirect check) need to
    // re-evaluate against the just-created session, not a cached
    // pre-sign-in render.
    router.refresh();
  }

  async function handleGoogle() {
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (authError) setError(authError.message);
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-center font-display text-2xl tracking-wide">
        {mode === "sign-in" ? t.auth.signInHeading : t.auth.signUpHeading}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t.auth.emailPlaceholder}
          aria-label={t.auth.emailPlaceholder}
          required
          autoComplete="email"
          className={FIELD_CLASS}
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={t.auth.passwordPlaceholder}
          aria-label={t.auth.passwordPlaceholder}
          required
          minLength={6}
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          className={FIELD_CLASS}
        />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-accent px-6 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? t.common.loading
            : mode === "sign-in"
              ? t.auth.signInAction
              : t.auth.signUpAction}
        </button>
      </form>

      <button
        type="button"
        onClick={handleGoogle}
        className="rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium transition-colors hover:border-foreground/30 hover:text-foreground dark:border-white/[.145]"
      >
        {t.auth.continueWithGoogle}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "sign-in" ? "sign-up" : "sign-in");
          setError(null);
        }}
        className="text-center text-sm text-foreground/60 transition-colors hover:text-foreground"
      >
        {mode === "sign-in" ? t.auth.switchToSignUp : t.auth.switchToSignIn}
      </button>
    </div>
  );
}
