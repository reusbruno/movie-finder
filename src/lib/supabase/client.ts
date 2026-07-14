import { createBrowserClient } from "@supabase/ssr";

// Lazy singleton, mirroring this app's other client-only lazy-init modules
// (see src/lib/auth.ts) - only ever constructed on first actual use from
// client code, never at module import time, so importing this file has no
// effect during a client component's server-side render pass.
let client: ReturnType<typeof createBrowserClient> | undefined;

export function getSupabaseBrowserClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}
