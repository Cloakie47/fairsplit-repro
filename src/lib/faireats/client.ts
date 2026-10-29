"use client";

/**
 * Browser-side access to the `/api/faireats/*` routes.
 *
 * All FairEats data goes through these routes and never through a Supabase
 * client in the browser — the FairEats tables have RLS on with no policies, so
 * the anon key cannot reach them by design (see issue #6).
 *
 * Reads retry. The first request after a cold start can fail while the server
 * establishes its connection to Supabase: DNS alone has been measured at ~15s,
 * which exceeds undici's 10s connect timeout and comes back as a 503. Without
 * a retry a perfectly healthy storefront presents as dead and needs a manual
 * reload, which is worse than it being slow. `onProgress` lets the UI say
 * "connecting" instead of hanging silently or flashing an error.
 */

import type { FairEatsTable, Merchant, MenuItem } from "./types";
import { menuItemFromWire, type WireMenuItem } from "./wire";

const READ_ATTEMPTS = 4;
const RETRY_DELAY_MS = 1200;

/** Reports a retry so callers can render a connecting state. */
export type ReadProgress = (state: {
  attempt: number;
  attempts: number;
}) => void;

export type ReadOptions = { onProgress?: ReadProgress };

/** Thrown for responses that will never succeed on retry (4xx). */
class PermanentError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function messageFrom(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

/**
 * GET with retry on transient failure. 4xx is returned immediately; 5xx and
 * network errors are retried with a short fixed backoff.
 */
async function readJson<T>(
  path: string,
  fallback: string,
  options?: ReadOptions,
): Promise<T> {
  let lastMessage = fallback;

  for (let attempt = 1; attempt <= READ_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (res.ok) return (await res.json()) as T;
      if (res.status < 500) {
        throw new PermanentError(await messageFrom(res, fallback));
      }
      lastMessage = await messageFrom(res, fallback);
    } catch (e) {
      if (e instanceof PermanentError) throw e;
      // Network-level failure (server not up yet, connection reset).
      lastMessage = fallback;
    }

    if (attempt < READ_ATTEMPTS) {
      options?.onProgress?.({ attempt, attempts: READ_ATTEMPTS });
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  throw new Error(lastMessage);
}

export async function fetchMerchants(
  options?: ReadOptions,
): Promise<Merchant[]> {
  const body = await readJson<{ merchants: Merchant[] }>(
    "/api/faireats/merchants",
    "Could not reach the kitchen. Check your connection and try again.",
    options,
  );
  return body.merchants;
}

export type Storefront = { merchant: Merchant; menu: MenuItem[] };

export async function fetchStorefront(
  slug: string,
  options?: ReadOptions,
): Promise<Storefront> {
  const body = await readJson<{ merchant: Merchant; menu: WireMenuItem[] }>(
    `/api/faireats/merchants/${encodeURIComponent(slug)}`,
    "Could not load this business. Check your connection and try again.",
    options,
  );
  return { merchant: body.merchant, menu: body.menu.map(menuItemFromWire) };
}

export type TablesResponse = {
  tables: FairEatsTable[];
  swept: number;
  isOwner: boolean;
};

export function fetchTables(
  slug: string,
  options?: ReadOptions,
): Promise<TablesResponse> {
  return readJson<TablesResponse>(
    `/api/faireats/tables?merchant=${encodeURIComponent(slug)}`,
    "Could not load the tables. Check your connection and try again.",
    options,
  );
}

export type TableMutationResult =
  | { ok: true; table: FairEatsTable }
  | { ok: false; error: string; conflict: boolean };

async function mutateTable(
  path: string,
  merchantSlug: string,
  tableId: string,
): Promise<TableMutationResult> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ merchantSlug, tableId }),
  });
  if (res.ok) {
    const body = (await res.json()) as { table: FairEatsTable };
    return { ok: true, table: body.table };
  }
  return {
    ok: false,
    error: await messageFrom(res, "That did not work. Try again."),
    // 409 means the world moved on (table taken, already free) rather than a
    // failure to retry — the caller should refresh the layout instead.
    conflict: res.status === 409,
  };
}

export function lockTable(
  merchantSlug: string,
  tableId: string,
): Promise<TableMutationResult> {
  return mutateTable("/api/faireats/tables/lock", merchantSlug, tableId);
}

export function releaseTable(
  merchantSlug: string,
  tableId: string,
): Promise<TableMutationResult> {
  return mutateTable("/api/faireats/tables/release", merchantSlug, tableId);
}
