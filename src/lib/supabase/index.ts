/**
 * Supabase entry points:
 * - `createClient` from `./browser` — Client Components
 * - `createClient` from `./server` — Server Components / Route Handlers (anon + cookies)
 * - `createAdminClient` from `./admin` — server-only, service role
 */

export { createClient as createBrowserClient } from "./browser";
export { createClient as createServerClient } from "./server";
export { createAdminClient } from "./admin";
