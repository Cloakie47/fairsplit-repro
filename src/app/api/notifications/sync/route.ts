import { NextResponse } from "next/server";

import type { NotificationItem } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificationToRow } from "@/lib/supabase-mappers";
import { verifyWalletSessionOrAuth } from "@/lib/verify-wallet-auth";

export const dynamic = "force-dynamic";

type PutBody = { notifications: NotificationItem[]; walletAddress?: string };

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

  const notifications = body.notifications;
  if (!Array.isArray(notifications)) {
    return NextResponse.json(
      { error: "notifications must be an array" },
      { status: 400 }
    );
  }

  const w = v.walletLower;
  for (const n of notifications) {
    if (n.userAddress.toLowerCase() !== w) {
      return NextResponse.json(
        { error: "Each notification must belong to the authenticated wallet" },
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
    .from("notifications")
    .delete()
    .eq("user_address", w);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 503 });
  }

  if (notifications.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  const rows = notifications.map((n) => notificationToRow(n));
  const { error: insErr } = await admin.from("notifications").insert(rows);

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 503 });
  }

  return NextResponse.json({ ok: true, count: notifications.length });
}
