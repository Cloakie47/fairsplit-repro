/**
 * FairEats data access. **Server-only** — uses the service-role client, which
 * bypasses RLS, and must never be imported from a client component.
 *
 * Every FairEats table has RLS on with no policies (see 002_faireats.sql), so
 * this module plus the signed `/api/faireats/*` routes are the only way in.
 * Deliberately does not use `src/lib/supabase.ts`, whose browser anon client
 * cannot reach these tables at all (see issue #2).
 */

import { createAdminClient } from "@/lib/supabase/admin";

import { TABLE_LOCK_TIMEOUT_MS } from "./config";
import type {
  FairEatsTable,
  Merchant,
  MenuItem,
  MenuOptionGroup,
  OptionGroupKind,
  TableStatus,
} from "./types";

/**
 * Memoised service-role client.
 *
 * `createAdminClient()` builds a fresh client, and therefore a fresh HTTP
 * connection pool, on every call. One storefront request runs four queries, so
 * a client per query paid DNS and TLS setup four times over; on a cold
 * connection that exceeded undici's 10s connect timeout and surfaced as
 * `TypeError: fetch failed` -> HTTP 503. One client per process reuses the
 * pool and keeps warm requests in the tens of milliseconds.
 *
 * Cache-bypass lives in `createAdminClient` itself, since no service-role read
 * should ever be served from Next's Data Cache.
 */
let adminClient: ReturnType<typeof createAdminClient> | null = null;

function admin(): ReturnType<typeof createAdminClient> {
  if (!adminClient) adminClient = createAdminClient();
  return adminClient;
}

type MerchantRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logo_path: string | null;
  cover_path: string | null;
  owner_address: string;
  payout_address: string;
  confidential_ready: boolean;
  is_open: boolean;
  created_at_ms: number | string;
};

type TableRow = {
  id: string;
  merchant_id: string;
  table_code: string;
  seats: number | null;
  status: TableStatus;
  occupant_address: string | null;
  locked_at_ms: number | string | null;
};

type OptionRow = {
  id: string;
  group_id: string;
  name: string;
  price_delta_usdc_micro: number | string;
  is_default: boolean;
  is_available: boolean;
  sort_order: number;
};

type GroupRow = {
  id: string;
  menu_item_id: string;
  name: string;
  kind: OptionGroupKind;
  min_select: number;
  max_select: number | null;
  sort_order: number;
};

type MenuItemRow = {
  id: string;
  merchant_id: string;
  name: string;
  description: string | null;
  category: string;
  base_price_usdc_micro: number | string;
  image_path: string | null;
  is_available: boolean;
  sort_order: number;
};

function merchantFromRow(row: MerchantRow): Merchant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline ?? undefined,
    logoPath: row.logo_path ?? undefined,
    coverPath: row.cover_path ?? undefined,
    ownerAddress: row.owner_address,
    payoutAddress: row.payout_address,
    confidentialReady: row.confidential_ready,
    isOpen: row.is_open,
    createdAt: Number(row.created_at_ms),
  };
}

/**
 * `viewerAddress` controls whether the occupant is disclosed. Other customers
 * must see an occupied table without learning whose wallet holds it, so the
 * address is only attached for the occupant themselves or the merchant owner.
 */
function tableFromRow(
  row: TableRow,
  opts: { viewerAddress?: string; ownerAddress?: string; now: number },
): FairEatsTable {
  const lockedAt = row.locked_at_ms === null ? undefined : Number(row.locked_at_ms);
  const viewer = opts.viewerAddress?.toLowerCase();
  const maySeeOccupant =
    !!viewer &&
    (viewer === row.occupant_address?.toLowerCase() ||
      viewer === opts.ownerAddress?.toLowerCase());
  return {
    id: row.id,
    merchantId: row.merchant_id,
    tableCode: row.table_code,
    seats: row.seats ?? undefined,
    status: row.status,
    occupantAddress: maySeeOccupant
      ? (row.occupant_address ?? undefined)
      : undefined,
    lockedAt,
    isStale:
      row.status === "occupied" &&
      lockedAt !== undefined &&
      opts.now - lockedAt > TABLE_LOCK_TIMEOUT_MS,
  };
}

export async function listMerchants(): Promise<Merchant[]> {
  const { data, error } = await admin()
    .from("faireats_merchants")
    .select("*")
    .order("created_at_ms", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as MerchantRow[]).map(merchantFromRow);
}

export async function getMerchantBySlug(slug: string): Promise<Merchant | null> {
  const { data, error } = await admin()
    .from("faireats_merchants")
    .select("*")
    .eq("slug", slug.toLowerCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? merchantFromRow(data as MerchantRow) : null;
}

/** Full menu for a merchant, with option groups and options nested. */
export async function getMenu(merchantId: string): Promise<MenuItem[]> {
  const { data: itemRows, error: itemErr } = await admin()
    .from("faireats_menu_items")
    .select("*")
    .eq("merchant_id", merchantId)
    .order("sort_order", { ascending: true });
  if (itemErr) throw new Error(itemErr.message);
  const items = (itemRows ?? []) as MenuItemRow[];
  if (items.length === 0) return [];

  const { data: groupRows, error: groupErr } = await admin()
    .from("faireats_option_groups")
    .select("*")
    .in(
      "menu_item_id",
      items.map((i) => i.id),
    )
    .order("sort_order", { ascending: true });
  if (groupErr) throw new Error(groupErr.message);
  const groups = (groupRows ?? []) as GroupRow[];

  const optionsByGroup = new Map<string, OptionRow[]>();
  if (groups.length > 0) {
    const { data: optionRows, error: optionErr } = await admin()
      .from("faireats_options")
      .select("*")
      .in(
        "group_id",
        groups.map((g) => g.id),
      )
      .order("sort_order", { ascending: true });
    if (optionErr) throw new Error(optionErr.message);
    for (const row of (optionRows ?? []) as OptionRow[]) {
      const list = optionsByGroup.get(row.group_id) ?? [];
      list.push(row);
      optionsByGroup.set(row.group_id, list);
    }
  }

  const groupsByItem = new Map<string, MenuOptionGroup[]>();
  for (const group of groups) {
    const list = groupsByItem.get(group.menu_item_id) ?? [];
    list.push({
      id: group.id,
      name: group.name,
      kind: group.kind,
      minSelect: group.min_select,
      maxSelect: group.max_select ?? undefined,
      options: (optionsByGroup.get(group.id) ?? []).map((option) => ({
        id: option.id,
        name: option.name,
        priceDeltaMicro: BigInt(option.price_delta_usdc_micro),
        isDefault: option.is_default,
        isAvailable: option.is_available,
      })),
    });
    groupsByItem.set(group.menu_item_id, list);
  }

  return items.map((item) => ({
    id: item.id,
    merchantId: item.merchant_id,
    name: item.name,
    description: item.description ?? undefined,
    category: item.category,
    basePriceMicro: BigInt(item.base_price_usdc_micro),
    imagePath: item.image_path ?? undefined,
    isAvailable: item.is_available,
    groups: groupsByItem.get(item.id) ?? [],
  }));
}

export async function listTables(
  merchantId: string,
  opts: { viewerAddress?: string; ownerAddress?: string } = {},
): Promise<FairEatsTable[]> {
  const { data, error } = await admin()
    .from("faireats_tables")
    .select("*")
    .eq("merchant_id", merchantId)
    .order("table_code", { ascending: true });
  if (error) throw new Error(error.message);
  const now = Date.now();
  return (data as TableRow[]).map((row) => tableFromRow(row, { ...opts, now }));
}

export type LockOutcome =
  | { ok: true; table: FairEatsTable }
  | { ok: false; reason: "taken" | "not_found" | "already_seated" };

/**
 * Claims a table for `occupantAddress`.
 *
 * The race between two customers tapping the same table is resolved by
 * Postgres, not by read-then-write: the UPDATE carries its own WHERE clause, so
 * exactly one of two concurrent calls matches a row and the other comes back
 * empty. A lock older than TABLE_LOCK_TIMEOUT_MS is treated as abandoned and
 * may be claimed, which is what stops a forgotten table being occupied forever.
 */
export async function lockTable(params: {
  merchantId: string;
  tableId: string;
  occupantAddress: string;
}): Promise<LockOutcome> {
  const now = Date.now();
  const staleCutoff = now - TABLE_LOCK_TIMEOUT_MS;
  const occupant = params.occupantAddress.toLowerCase();

  // One customer may hold at most one table per merchant at a time.
  const { data: existing, error: existingErr } = await admin()
    .from("faireats_tables")
    .select("id")
    .eq("merchant_id", params.merchantId)
    .eq("status", "occupied")
    .eq("occupant_address", occupant)
    .gte("locked_at_ms", staleCutoff);
  if (existingErr) throw new Error(existingErr.message);
  if ((existing ?? []).some((row) => row.id !== params.tableId)) {
    return { ok: false, reason: "already_seated" };
  }

  const { data, error } = await admin()
    .from("faireats_tables")
    .update({
      status: "occupied",
      occupant_address: occupant,
      locked_at_ms: now,
    })
    .eq("id", params.tableId)
    .eq("merchant_id", params.merchantId)
    .or(`status.eq.available,locked_at_ms.lt.${staleCutoff}`)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    // Either the row does not exist or someone else holds a fresh lock.
    const { data: probe } = await admin()
      .from("faireats_tables")
      .select("id")
      .eq("id", params.tableId)
      .eq("merchant_id", params.merchantId)
      .maybeSingle();
    return { ok: false, reason: probe ? "taken" : "not_found" };
  }

  return {
    ok: true,
    table: tableFromRow(data as TableRow, {
      viewerAddress: occupant,
      now,
    }),
  };
}

export type ReleaseOutcome =
  | { ok: true; table: FairEatsTable }
  | { ok: false; reason: "not_found" | "forbidden" | "already_available" };

/**
 * Releases a table. Permitted for the current occupant, for the merchant owner,
 * or by anyone once the lock is stale — owner-only release would strand a table
 * whose customer simply walked out.
 */
export async function releaseTable(params: {
  merchantId: string;
  tableId: string;
  requesterAddress: string;
  ownerAddress: string;
}): Promise<ReleaseOutcome> {
  const now = Date.now();
  const requester = params.requesterAddress.toLowerCase();
  const isOwner = requester === params.ownerAddress.toLowerCase();

  const { data: row, error } = await admin()
    .from("faireats_tables")
    .select("*")
    .eq("id", params.tableId)
    .eq("merchant_id", params.merchantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return { ok: false, reason: "not_found" };

  const table = row as TableRow;
  if (table.status === "available") {
    return { ok: false, reason: "already_available" };
  }

  const lockedAt = table.locked_at_ms === null ? 0 : Number(table.locked_at_ms);
  const isStale = now - lockedAt > TABLE_LOCK_TIMEOUT_MS;
  const isOccupant = table.occupant_address?.toLowerCase() === requester;
  if (!isOwner && !isOccupant && !isStale) {
    return { ok: false, reason: "forbidden" };
  }

  const { data: updated, error: updateErr } = await admin()
    .from("faireats_tables")
    .update({ status: "available", occupant_address: null, locked_at_ms: null })
    .eq("id", params.tableId)
    .eq("merchant_id", params.merchantId)
    .select("*")
    .maybeSingle();
  if (updateErr) throw new Error(updateErr.message);
  if (!updated) return { ok: false, reason: "not_found" };

  return {
    ok: true,
    table: tableFromRow(updated as TableRow, {
      viewerAddress: requester,
      ownerAddress: params.ownerAddress,
      now,
    }),
  };
}

/**
 * Sweeps abandoned locks for one merchant. Cheap enough to call opportunistically
 * whenever the table list is read, which avoids needing a scheduled job.
 */
export async function sweepStaleTableLocks(merchantId: string): Promise<number> {
  const cutoff = Date.now() - TABLE_LOCK_TIMEOUT_MS;
  const { data, error } = await admin()
    .from("faireats_tables")
    .update({ status: "available", occupant_address: null, locked_at_ms: null })
    .eq("merchant_id", merchantId)
    .eq("status", "occupied")
    .lt("locked_at_ms", cutoff)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}
