import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// Module-level store, same idiom as watch-region.ts/language.ts - not
// Context+useState. `undefined` = not yet resolved (first paint, before
// the session read below settles); `null` = resolved, signed out; `User` =
// resolved, signed in. Lazily initialized on first getUser()/subscribeToAuth()
// call, never at module import time, so importing this file has no effect
// during a client component's server-side render pass.
let currentUser: User | null | undefined = undefined;
let initialized = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function ensureInitialized() {
  if (initialized) return;
  initialized = true;

  const supabase = getSupabaseBrowserClient();

  // onAuthStateChange fires immediately with the current session on
  // subscribe (an INITIAL_SESSION event), so this alone would eventually
  // resolve `currentUser` - the explicit getSession() call below is just
  // belt-and-suspenders for that first resolution, not load-bearing.
  supabase.auth.getSession().then((result: { data: { session: Session | null } }) => {
    currentUser = result.data.session?.user ?? null;
    notify();
  });

  supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
    currentUser = session?.user ?? null;
    notify();
  });
}

export function getUser(): User | null | undefined {
  ensureInitialized();
  return currentUser;
}

export function subscribeToAuth(callback: () => void): () => void {
  ensureInitialized();
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  await supabase.auth.signOut();
}
