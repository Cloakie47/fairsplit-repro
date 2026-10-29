import { NextResponse } from "next/server";

import { getMerchantBySlug, releaseTable } from "@/lib/faireats/db";
import { verifyWalletSessionOrAuth } from "@/lib/verify-wallet-auth";

export const dynamic = "force-dynamic";

type Body = {
  merchantSlug?: string;
  tableId?: string;
  walletAddress?: string;
  message?: string;
  signature?: string;
};

/**
 * Releases a table. Allowed for the occupant, the merchant owner, or anyone
 * once the lock has gone stale.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const auth = await verifyWalletSessionOrAuth(request, body);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const slug = (body.merchantSlug ?? "").trim().toLowerCase();
  const tableId = (body.tableId ?? "").trim();
  if (!slug || !tableId) {
    return NextResponse.json(
      { error: "Missing merchantSlug or tableId" },
      { status: 400 },
    );
  }

  try {
    const merchant = await getMerchantBySlug(slug);
    if (!merchant) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    }

    const outcome = await releaseTable({
      merchantId: merchant.id,
      tableId,
      requesterAddress: auth.walletLower,
      ownerAddress: merchant.ownerAddress,
    });

    if (outcome.ok) {
      return NextResponse.json({ table: outcome.table });
    }
    if (outcome.reason === "forbidden") {
      return NextResponse.json(
        { error: "Only the person seated there or the merchant can free this table." },
        { status: 403 },
      );
    }
    if (outcome.reason === "already_available") {
      return NextResponse.json(
        { error: "That table is already free." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not free table";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
