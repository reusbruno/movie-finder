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
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
