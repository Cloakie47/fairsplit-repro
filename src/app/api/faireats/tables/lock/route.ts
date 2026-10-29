import { NextResponse } from "next/server";

import { getMerchantBySlug, lockTable } from "@/lib/faireats/db";
import { verifyWalletSessionOrAuth } from "@/lib/verify-wallet-auth";

export const dynamic = "force-dynamic";

type Body = {
  merchantSlug?: string;
  tableId?: string;
  walletAddress?: string;
  message?: string;
  signature?: string;
};

/** Claims an unoccupied table for the authenticated wallet. */
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

    const outcome = await lockTable({
      merchantId: merchant.id,
      tableId,
      occupantAddress: auth.walletLower,
    });

    if (outcome.ok) {
      return NextResponse.json({ table: outcome.table });
    }

    // 409 for the lost race so the client can refresh and re-render rather
    // than treating it as a failure to retry.
    if (outcome.reason === "taken") {
      return NextResponse.json(
        { error: "That table was just taken. Pick another one." },
        { status: 409 },
      );
    }
    if (outcome.reason === "already_seated") {
      return NextResponse.json(
        { error: "You already have a table here. Release it first." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  } catch (e) {
    // Never surface the raw error: a cold Supabase connection throws
    // "TypeError: fetch failed", which is meaningless to a diner. Log the
    // real cause server-side; the client retries 5xx before showing this.
    console.error("[faireats] lock", e);
    return NextResponse.json(
      { error: "Could not claim that table right now." },
      { status: 503 },
    );
  }
}
