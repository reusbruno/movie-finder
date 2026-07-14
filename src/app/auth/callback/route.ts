import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// The redirect target Google (or any OAuth provider) sends the browser
// back to after consent - exchanges the one-time `code` for a real
// session, written to cookies via getSupabaseServerClient's setAll, then
// sends the browser on to wherever the sign-in flow actually started
// (auth-form.tsx's `next` param, round-tripped through the OAuth
// provider's own redirectTo).
//
// NOTE: this exact URL (origin + /auth/callback) must be added to the
// Supabase project's Auth > URL Configuration > Redirect URLs allowlist
// for both the local dev origin and the deployed production origin -
// Google OAuth will fail with a redirect/consent error otherwise. This is
// a dashboard-side setting I can't apply myself.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/movies";

  if (code) {
    const supabase = await getSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
