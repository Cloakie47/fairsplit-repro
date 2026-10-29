import { NextResponse } from "next/server";

import type { Friend } from "@/lib/friends";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendToRow } from "@/lib/supabase-mappers";
import { verifyWalletSessionOrAuth } from "@/lib/verify-wallet-auth";

export const dynamic = "force-dynamic";

type PutBody = { friends: Friend[]; walletAddress?: string };

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

  const friends = body.friends;
  if (!Array.isArray(friends)) {
    return NextResponse.json({ error: "friends must be an array" }, { status: 400 });
  }

  for (const f of friends) {
    if (f.ownerAddress?.toLowerCase() !== v.walletLower) {
      return NextResponse.json(
        { error: "All friends must belong to authenticated wallet" },
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

  const { error: delErr } = await admin
    .from("friends")
    .delete()
    .eq("owner_address", v.walletLower);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 503 });
  }

  if (friends.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  const rows = friends.map(friendToRow);
  const { error: insErr } = await admin.from("friends").insert(rows);

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 503 });
  }

  return NextResponse.json({ ok: true, count: friends.length });
}
