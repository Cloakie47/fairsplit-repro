import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

type Recipient = {
  email: string;
  walletAddress: string;
  displayName?: string;
};

type Payload = {
  splitName: string;
  creatorAddress: string;
  creatorDisplayName?: string;
  amountUsdc: string;
  customReminder?: string;
  appUrl?: string;
  recipients: Recipient[];
};

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error("Email is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD.");
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as Payload;
    if (!payload?.splitName || !payload?.creatorAddress) {
      return NextResponse.json(
        { ok: false, error: "Missing split data." },
        { status: 400 }
      );
    }
    const recipients = (payload.recipients ?? []).filter((r) => !!r.email);
    if (recipients.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, skipped: 0 });
    }

    const transport = getTransport();
    const fromAddress = process.env.GMAIL_USER as string;
    const appUrl = payload.appUrl || "http://localhost:3000";
    const creatorLabel =
      payload.creatorDisplayName?.trim() ||
      `${payload.creatorAddress.slice(0, 6)}...${payload.creatorAddress.slice(-4)}`;

    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      const toLabel =
        recipient.displayName?.trim() ||
        `${recipient.walletAddress.slice(0, 6)}...${recipient.walletAddress.slice(-4)}`;
      const subject = `FairySplit: New split request - ${payload.splitName}`;
      const reminder = payload.customReminder?.trim();
      const body = `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;">
          <h2 style="margin:0 0 12px;">FairySplit Payment Request</h2>
          <p>Hi ${escapeHtml(toLabel)},</p>
          <p><strong>${escapeHtml(creatorLabel)}</strong> added you to a split:</p>
          <p style="margin:10px 0;padding:12px;background:#f5f5f5;border-radius:8px;">
            <strong>Split:</strong> ${escapeHtml(payload.splitName)}<br/>
            <strong>Amount per person:</strong> ${escapeHtml(payload.amountUsdc)} USDC
          </p>
          ${
            reminder
              ? `<p><strong>Note:</strong> ${escapeHtml(reminder)}</p>`
              : ""
          }
          <p>
            Open FairySplit to review and pay:
            <a href="${escapeHtml(appUrl)}" style="color:#0a58ca;">${escapeHtml(appUrl)}</a>
          </p>
          <p style="font-size:12px;color:#666;">This message was sent by FairySplit.</p>
        </div>
      `;

      try {
        await transport.sendMail({
          from: `"FairySplit" <${fromAddress}>`,
          to: recipient.email,
          subject,
          html: body,
        });
        sent += 1;
      } catch {
        failed += 1;
      }
    }

    return NextResponse.json({ ok: true, sent, failed });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to send split emails.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

