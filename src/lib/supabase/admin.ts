import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — **server-only** (API routes, server actions).
 * Bypasses RLS. Never import from client components or expose the key.
 *
 * Next caches `fetch()` in route handlers by default, and that includes the
 * requests supabase-js makes internally. `export const dynamic = "force-dynamic"`
 * does **not** prevent this: it stops the *route* being cached, while the
 * outgoing fetch to PostgREST is still served from the Data Cache. The result
 * is a handler that re-runs on every request and still returns stale rows.
 *
 * Service-role reads are live data by definition, so caching is never wanted
 * here. The opt-out has to sit on the client's own fetch.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
