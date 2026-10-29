"use client";

/**
 * Browser-side access to the `/api/faireats/*` routes.
 *
 * All FairEats data goes through these routes and never through a Supabase
 * client in the browser — the FairEats tables have RLS on with no policies, so
 * the anon key cannot reach them by design (see issue #2 for the existing
 * module that gets this wrong).
 */

import type { FairEatsTable, Merchant, MenuItem } from "./types";
import { menuItemFromWire, type WireMenuItem } from "./wire";

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchMerchants(): Promise<Merchant[]> {
  const res = await fetch("/api/faireats/merchants", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(await readError(res, "Could not load businesses"));
  }
  const body = (await res.json()) as { merchants: Merchant[] };
  return body.merchants;
}

export type Storefront = { merchant: Merchant; menu: MenuItem[] };

export async function fetchStorefront(slug: string): Promise<Storefront> {
  const res = await fetch(`/api/faireats/merchants/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await readError(res, "Could not load this business"));
  }
  const body = (await res.json()) as {
    merchant: Merchant;
    menu: WireMenuItem[];
  };
  return { merchant: body.merchant, menu: body.menu.map(menuItemFromWire) };
}

export type TablesResponse = {
  tables: FairEatsTable[];
  swept: number;
  isOwner: boolean;
};

export async function fetchTables(slug: string): Promise<TablesResponse> {
  const res = await fetch(
    `/api/faireats/tables?merchant=${encodeURIComponent(slug)}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(await readError(res, "Could not load tables"));
  }
  return (await res.json()) as TablesResponse;
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
    error: await readError(res, "That did not work. Try again."),
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
