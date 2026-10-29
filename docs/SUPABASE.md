# Supabase setup (FairySplit)

The app uses [Supabase](https://supabase.com) as the **source of truth** for profile, friends, activity, split requests, and notifications when `NEXT_PUBLIC_SUPABASE_URL` is set. Data is still mirrored in **localStorage** for fast reads and offline-ish UX.

## 1. Create a project

1. Go to [supabase.com](https://supabase.com) → New project.
2. Note **Project URL** and **anon (public) key** under **Settings → API**.
3. Copy the **service_role** key (same page) — **server-only**, never expose to the browser.

## 2. Environment variables

Copy `.env.example` to `.env.local` (or `.env`) and set:

| Variable | Where |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` **secret** (API routes / server only) |

Restart `npm run dev` after changing env.

Without `NEXT_PUBLIC_SUPABASE_URL`, the app runs **local-only** (no cloud sync).

## 3. Run the SQL migration

1. Supabase Dashboard → **SQL Editor** → New query.
2. Paste the contents of `supabase/migrations/001_initial_schema.sql`.
3. Run. You should see success; tables appear under **Table Editor**.

(Optional) If you use the [Supabase CLI](https://supabase.com/docs/guides/cli), you can link the project and apply migrations from that folder instead.

## 4. Verify

With all three env vars set and migrations applied:

```text
GET /api/health/supabase
```

Expect JSON: `{ "ok": true, "database": "reachable" }`.

## 5. Cloud sync behavior

- **`CloudSyncProvider`** (in `providers.tsx`): only registers the **signer** for cloud APIs. It does **not** pull on page load.
- **After “Connect Wallet”** (in `WalletConnect` or app **`Topbar`**): `connectAsync` completes, then **`pullCloudDataAfterConnect`** runs → prompts for a **wallet signature** (no gas) → **`POST /api/data/pull`** loads your rows into localStorage. No sign prompt on the marketing landing page unless the user clicks Connect there.
- **Profile save / clear**: **`PUT` / `DELETE /api/profile`** — signature required when cloud is enabled (see Profile page).
- **Friends / activity / notifications**: debounced **`PUT`** to `/api/friends`, `/api/activity`, `/api/notifications/sync` after local changes (each push asks for a signature when the debounced job runs).
- **Split requests**: **`POST /api/split-requests/create`** (creator) and **`PATCH /api/split-requests/mark-paid`** (participant); optional **`PUT /api/split-requests/sync`** for backup merges.

Auth message format: `buildWalletAuthMessage` in `src/lib/wallet-auth-message.ts` (parsed + verified with **viem** on the server).

**Security:** RLS stays on with **no anon policies**; **service role** is only used in Route Handlers after **signature verification**. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.

## 6. Low-level clients

| Import | Use |
|--------|-----|
| `@/lib/supabase/browser` → `createClient()` | Client Components (anon key; RLS applies). |
| `@/lib/supabase/server` → `createClient()` | Server Components / Route Handlers (anon + cookies). |
| `@/lib/supabase/admin` → `createAdminClient()` | **Server-only** in API routes. |

## 7. Schema ↔ app types

- `profiles` → `Profile` (`profile.ts`)
- `friends` → `Friend` (`friends.ts`)
- `activity_items` → `ActivityItem` (`activity.ts`)
- `split_requests` → `SplitRequest` (`requests.ts`)
- `notifications` → `NotificationItem` (`notifications.ts`)

Column names use `snake_case` in SQL; see `src/lib/supabase-mappers.ts`.
