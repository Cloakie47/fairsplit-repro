import { NextResponse } from "next/server";

import type { SplitRequest } from "@/lib/requests";
import { createAdminClient } from "@/lib/supabase/admin";
import { splitRequestToRow } from "@/lib/supabase-mappers";
import { verifyWalletSessionOrAuth } from "@/lib/verify-wallet-auth";

export const dynamic = "force-dynamic";

type PutBody = { requests: SplitRequest[]; walletAddress?: string };

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

  const requests = body.requests;
  if (!Array.isArray(requests)) {
    return NextResponse.json({ error: "requests must be an array" }, { status: 400 });
  }

  const w = v.walletLower;
  for (const r of requests) {
    const c = r.creatorAddress.toLowerCase();
    const p = r.participantAddress.toLowerCase();
    if (c !== w && p !== w) {
      return NextResponse.json(
        { error: "Each request must involve the authenticated wallet" },
        { status: 403 }
      );
    }
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Supabase not configured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  if (requests.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  const rows = requests.map((r) => splitRequestToRow(r));
  const { error } = await admin
    .from("split_requests")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  return NextResponse.json({ ok: true, count: requests.length });
}
