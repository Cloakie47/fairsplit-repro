import { NextResponse } from "next/server";

import type { ActivityItem } from "@/lib/activity";
import { createAdminClient } from "@/lib/supabase/admin";
import { activityToRow } from "@/lib/supabase-mappers";
import { verifyWalletSessionOrAuth } from "@/lib/verify-wallet-auth";

export const dynamic = "force-dynamic";

type PutBody = { items: ActivityItem[]; walletAddress?: string };

export async function PUT(request: Request) {
  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const v = await verifyWalletSessionOrAuth(request, body);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: v.status });
  }

  const items = body.items;
  if (!Array.isArray(items)) {
    return NextResponse.json({ error: "items must be an array" }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Supabase not configured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const { error: delErr } = await admin
    .from("activity_items")
    .delete()
    .eq("wallet_address", v.walletLower);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 503 });
  }

  if (items.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  const rows = items.map((item) => activityToRow(v.walletLower, item));
  const { error: insErr } = await admin.from("activity_items").insert(rows);

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 503 });
  }

  return NextResponse.json({ ok: true, count: items.length });
}
