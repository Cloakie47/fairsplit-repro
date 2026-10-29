import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import type { NotificationItem } from "@/lib/notifications";
import type { SplitRequestStatus } from "@/lib/requests";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  notificationToRow,
  splitRequestRowToClient,
} from "@/lib/supabase-mappers";
import { verifyWalletSessionOrAuth } from "@/lib/verify-wallet-auth";

export const dynamic = "force-dynamic";

function normalize(address: string): string {
  return address.toLowerCase();
}

type MarkPaidBody = {
  chainId: number;
  billId: string;
  participantAddress: string;
  mode: "normal" | "confidential";
  splitName: string;
  creatorAddress: string;
  walletAddress?: string;
};

export async function PATCH(request: Request) {
  let body: MarkPaidBody;
  try {
    body = (await request.json()) as MarkPaidBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const v = await verifyWalletSessionOrAuth(request, body);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: v.status });
  }

  const participant = normalize(body.participantAddress);
  if (participant !== v.walletLower) {
    return NextResponse.json(
      { error: "participantAddress must match signer" },
      { status: 403 }
    );
  }

  if (
    typeof body.chainId !== "number" ||
    !body.billId ||
    !body.splitName ||
    !body.creatorAddress
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const creator = normalize(body.creatorAddress);
  const now = Date.now();
  const nextStatus: SplitRequestStatus =
    body.mode === "normal" ? "paid_normal" : "paid_confidential";

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Supabase not configured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const { data: existing, error: fetchErr } = await admin
    .from("split_requests")
    .select("*")
    .eq("chain_id", body.chainId)
    .eq("bill_id", body.billId)
    .eq("participant_address", participant)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 503 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Split request not found" }, { status: 404 });
  }

  const { error: upErr } = await admin
    .from("split_requests")
    .update({
      status: nextStatus,
      is_confidential: body.mode === "confidential",
      paid_at_ms: now,
    })
    .eq("id", existing.id);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 503 });
  }

  const notification: NotificationItem = {
    id: randomUUID(),
    userAddress: creator,
    type:
      body.mode === "normal"
        ? "split_paid_normal"
        : "split_paid_confidential",
    title:
      body.mode === "normal"
        ? "Split paid (normal)"
        : "Split paid (confidential)",
    body:
      body.mode === "normal"
        ? `${participant.slice(0, 6)}...${participant.slice(-4)} paid "${body.splitName}".`
        : `A confidential payment was completed for "${body.splitName}".`,
    isRead: false,
    relatedChainId: body.chainId,
    relatedBillId: body.billId,
    createdAt: now,
  };

  const { error: nErr } = await admin
    .from("notifications")
    .insert(notificationToRow(notification));

  if (nErr) {
    return NextResponse.json({ error: nErr.message }, { status: 503 });
  }

  const { data: updated } = await admin
    .from("split_requests")
    .select("*")
    .eq("id", existing.id)
    .single();

  return NextResponse.json({
    request: updated ? splitRequestRowToClient(updated) : null,
    notification,
  });
}
