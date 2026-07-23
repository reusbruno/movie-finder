import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Named "proxy" (not "middleware") and rooted at src/, matching this app's
// convention - see AGENTS.md and node_modules/next/dist/docs's own
// proxy.md: Next 16 renamed the middleware file convention to "proxy".
//
// Refreshes the Supabase session cookie on every request. Without this,
// Server Components (getSupabaseServerClient) can't write the refreshed
// token back to cookies themselves - see the try/catch in
// src/lib/supabase/server.ts - so a session would silently go stale.
//
// Also enforces an absolute session lifetime: Supabase's refresh tokens
// have no time limit of their own by default (they just keep rotating
// as long as the app is used), so without this a session can persist
// indefinitely. Supabase Dashboard has a native "time-box sessions"
// setting for this, but that's project-level config this repo can't
// set - this cookie is the app-level enforcement layer instead.
const SESSION_MARKER_COOKIE = "app-session-started-at";
const MAX_SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // Reading the session is what actually triggers a refresh (and the
  // setAll write above) when the access token has expired.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const markerValue = request.cookies.get(SESSION_MARKER_COOKIE)?.value;
  const markerStartedAt = markerValue ? Number(markerValue) : NaN;

  if (user) {
    const sessionExpired =
      !Number.isNaN(markerStartedAt) &&
      Date.now() - markerStartedAt > MAX_SESSION_AGE_MS;

    if (sessionExpired) {
      // Absolute cap hit regardless of activity - revoke server-side
      // (also clears the sb-* auth cookies via setAll above) so the
      // user has to sign in again; drop the marker so the next sign-in
      // starts a fresh window.
      await supabase.auth.signOut();
      response.cookies.delete(SESSION_MARKER_COOKIE);
    } else if (Number.isNaN(markerStartedAt)) {
      // First request we've seen this session on (fresh sign-in, or an
      // already-logged-in user hitting the app after this deploy) -
      // start the countdown now.
      response.cookies.set(SESSION_MARKER_COOKIE, String(Date.now()), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: MAX_SESSION_AGE_MS / 1000,
      });
    }
  } else if (markerValue) {
    // No session but a stale marker is lingering (token expired and
    // couldn't refresh) - clean it up rather than leave it dangling.
    response.cookies.delete(SESSION_MARKER_COOKIE);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
