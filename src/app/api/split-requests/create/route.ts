import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import type { NotificationItem } from "@/lib/notifications";
import type { SplitRequest } from "@/lib/requests";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  notificationToRow,
  splitRequestRowToClient,
  splitRequestToRow,
} from "@/lib/supabase-mappers";
import { verifyWalletSessionOrAuth } from "@/lib/verify-wallet-auth";

export const dynamic = "force-dynamic";

function normalize(address: string): string {
  return address.toLowerCase();
}

type CreateBody = {
  chainId: number;
  billId: string;
  splitName: string;
  creatorAddress: string;
  participants: string[];
  amountUsdc: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  customReminder?: string;
  walletAddress?: string;
};

type EmailRecipient = {
  email: string;
  walletAddress: string;
  displayName?: string;
  creatorCopy?: boolean;
};

export async function POST(request: Request) {
  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const v = await verifyWalletSessionOrAuth(request, body);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: v.status });
  }

  const creator = normalize(body.creatorAddress);
  if (creator !== v.walletLower) {
    return NextResponse.json(
      { error: "creatorAddress must match signer" },
      { status: 403 }
    );
  }

  if (
    typeof body.chainId !== "number" ||
    !body.billId ||
    !body.splitName ||
    !Array.isArray(body.participants) ||
    !body.amountUsdc
  ) {
    return NextResponse.json({ error: "Invalid split payload" }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Supabase not configured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const now = Date.now();
  const next: SplitRequest[] = body.participants
    .map((addr) => normalize(addr))
    .filter((addr) => addr !== creator)
    .map((participant) => ({
      id: `${body.chainId}-${body.billId}-${participant}`,
      chainId: body.chainId,
      billId: body.billId,
      splitName: body.splitName,
      creatorAddress: creator,
      participantAddress: participant,
      amountUsdc: body.amountUsdc,
      tokenAddress: body.tokenAddress,
      tokenSymbol: body.tokenSymbol,
      isConfidential: false,
      status: "pending" as const,
      createdAt: now,
    }));

  const notificationsToInsert: NotificationItem[] = [];
  const emailRecipients: EmailRecipient[] = [];

  const { data: creatorProfile } = await admin
    .from("profiles")
    .select("email, display_name")
    .eq("wallet_address", creator)
    .maybeSingle();

  const creatorEmail =
    typeof creatorProfile?.email === "string" ? creatorProfile.email.trim() : "";
  if (creatorEmail) {
    emailRecipients.push({
      email: creatorEmail,
      walletAddress: creator,
      displayName: creatorProfile?.display_name ?? undefined,
      creatorCopy: true,
    });
  }

  for (const req of next) {
    notificationsToInsert.push({
      id: randomUUID(),
      userAddress: req.participantAddress,
      type: "split_created",
      title: "New split request",
      body: body.customReminder?.trim()
        ? `${body.splitName}: ${body.customReminder.trim()}`
        : `You were added to "${body.splitName}".`,
      isRead: false,
      relatedChainId: body.chainId,
      relatedBillId: body.billId,
      createdAt: now,
    });

    const { data: participantProfile } = await admin
      .from("profiles")
      .select("email, email_reminders_opt_in")
      .eq("wallet_address", req.participantAddress)
      .maybeSingle();

    const { data: friendRow } = await admin
      .from("friends")
      .select("friend_email, nickname")
      .eq("owner_address", req.creatorAddress)
      .eq("friend_address", req.participantAddress)
      .maybeSingle();

    const recipientByEmail = new Map<string, EmailRecipient>();
    const friendEmail =
      typeof friendRow?.friend_email === "string" ? friendRow.friend_email.trim() : "";
    if (friendEmail) {
      recipientByEmail.set(friendEmail.toLowerCase(), {
        email: friendEmail,
        walletAddress: req.participantAddress,
        displayName: friendRow?.nickname ?? undefined,
      });
    }

    if (
      participantProfile?.email &&
      participantProfile.email_reminders_opt_in
    ) {
      const profileEmail = participantProfile.email.trim();
      if (profileEmail) {
        recipientByEmail.set(profileEmail.toLowerCase(), {
          email: profileEmail,
          walletAddress: req.participantAddress,
        });
      }
    }

    for (const recipient of Array.from(recipientByEmail.values())) {
      emailRecipients.push(recipient);
    }
  }

  let sentCount = 0;
  let failedCount = 0;
  let emailStatusNotificationAdded = false;
  const dedupedEmailRecipients = Array.from(
    new Map(emailRecipients.map((recipient) => [recipient.email.toLowerCase(), recipient])).values()
  );
  if (dedupedEmailRecipients.length > 0) {
    try {
      const emailRes = await fetch(new URL("/api/email/split-request", request.url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          splitName: body.splitName,
          creatorAddress: creator,
          amountUsdc: body.amountUsdc,
          tokenAddress: body.tokenAddress,
          tokenSymbol: body.tokenSymbol,
          customReminder: body.customReminder,
          recipients: dedupedEmailRecipients,
        }),
      });
      const emailJson = (await emailRes.json().catch(() => ({}))) as {
        sent?: number;
        failed?: number;
        error?: string;
        errors?: Array<{ email?: string; reason?: string }>;
      };
      sentCount = Number(emailJson.sent ?? 0);
      failedCount = Number(emailJson.failed ?? 0);
      const firstError =
        emailJson.error ??
        emailJson.errors?.find((item) => item?.reason)?.reason ??
        null;
      if (!emailRes.ok && failedCount === 0) {
        failedCount = dedupedEmailRecipients.length;
      }
      if (firstError && sentCount === 0) {
        notificationsToInsert.push({
          id: randomUUID(),
          userAddress: creator,
          type: "reminder",
          title: "Email alerts failed",
          body: `Email provider error: ${firstError}`,
          isRead: false,
          relatedChainId: body.chainId,
          relatedBillId: body.billId,
          createdAt: now,
        });
        emailStatusNotificationAdded = true;
      }
    } catch {
      failedCount = dedupedEmailRecipients.length;
    }
  }

  if (dedupedEmailRecipients.length > 0 && !emailStatusNotificationAdded) {
    notificationsToInsert.push({
      id: randomUUID(),
      userAddress: creator,
      type: "reminder",
      title: sentCount > 0 ? "Email alerts sent" : "Email alerts failed",
      body:
        sentCount > 0
          ? `${sentCount} reminder email${sentCount === 1 ? "" : "s"} sent${
              failedCount > 0 ? ` (${failedCount} failed)` : ""
            }.`
          : "No reminder emails were sent. Check email configuration (GMAIL_USER / GMAIL_APP_PASSWORD).",
      isRead: false,
      relatedChainId: body.chainId,
      relatedBillId: body.billId,
      createdAt: now,
    });
  }

  const reqRows = next.map((r) => splitRequestToRow(r));
  const { error: upErr } = await admin
    .from("split_requests")
    .upsert(reqRows, { onConflict: "id" });

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 503 });
  }

  if (notificationsToInsert.length > 0) {
    const notifRows = notificationsToInsert.map((n) => notificationToRow(n));
    const { error: nErr } = await admin.from("notifications").upsert(notifRows, {
      onConflict: "id",
    });
    if (nErr) {
      return NextResponse.json({ error: nErr.message }, { status: 503 });
    }
  }

  const { data: stored } = await admin
    .from("split_requests")
    .select("*")
    .in(
      "id",
      next.map((r) => r.id)
    );

  const requests = (stored ?? []).map((row) => splitRequestRowToClient(row));

  return NextResponse.json({
    requests,
    notifications: notificationsToInsert,
  });
}
