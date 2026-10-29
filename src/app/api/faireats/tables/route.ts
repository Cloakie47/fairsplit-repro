import { NextResponse } from "next/server";

import {
  getMerchantBySlug,
  listTables,
  sweepStaleTableLocks,
} from "@/lib/faireats/db";
import { readOptionalWallet } from "@/lib/faireats/wire";

export const dynamic = "force-dynamic";

/**
 * Table layout for one merchant.
 *
 * Public, because which tables are free is exactly what a walk-in customer
 * needs. Occupant addresses are withheld unless the caller is that occupant or
 * the merchant owner — see `tableFromRow` in `db.ts`.
 *
 * Reading also sweeps abandoned locks for this merchant, so a forgotten table
 * frees itself without a scheduled job.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = (searchParams.get("merchant") ?? "").trim().toLowerCase();
  if (!slug) {
    return NextResponse.json(
      { error: "Missing merchant parameter" },
      { status: 400 },
    );
  }

  try {
    const merchant = await getMerchantBySlug(slug);
    if (!merchant) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    }

    const swept = await sweepStaleTableLocks(merchant.id);
    const viewerAddress = readOptionalWallet(request);
    const tables = await listTables(merchant.id, {
      viewerAddress,
      ownerAddress: merchant.ownerAddress,
    });

    return NextResponse.json({
      tables,
      swept,
      isOwner:
        !!viewerAddress &&
        viewerAddress === merchant.ownerAddress.toLowerCase(),
    });
  } catch (e) {
    // Never surface the raw error: a cold Supabase connection throws
    // "TypeError: fetch failed", which is meaningless to a diner. Log the
    // real cause server-side; the client retries 5xx before showing this.
    console.error("[faireats] tables", e);
    return NextResponse.json(
      { error: "Could not load the tables right now." },
      { status: 503 },
    );
  }
}
