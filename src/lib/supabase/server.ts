import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// A fresh client per request, per Supabase's own guidance - never shared
// across requests like the browser singleton is. Used by Server Components
// (the watchlist page) and the OAuth callback route.
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, which can't write cookies -
            // proxy.ts (src/proxy.ts) is what actually refreshes and
            // persists the session cookie on every request; this catch
            // just lets a Server Component read the current session
            // without crashing on the write it can't perform itself.
          }
        },
      },
    }
  );
}
