import { NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";

import { createAdminClient } from "@/lib/supabase/admin";
import { profileRowToClient } from "@/lib/supabase-mappers";
import { verifyWalletSessionOrAuth } from "@/lib/verify-wallet-auth";

export const dynamic = "force-dynamic";

/** Public: display name only */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("address");
  if (!raw || !isAddress(raw)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ profile: null, source: "supabase_unconfigured" });
  }

  const wallet = getAddress(raw).toLowerCase();
  const { data, error } = await admin
    .from("profiles")
    .select("wallet_address, display_name")
    .eq("wallet_address", wallet)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  if (!data) {
    return NextResponse.json({ profile: null });
  }

  return NextResponse.json({
    profile: {
      walletAddress: data.wallet_address,
      displayName: data.display_name ?? undefined,
    },
  });
}

type PutBody = {
  displayName?: string;
  email?: string;
  emailRemindersOptIn?: boolean;
  walletAddress?: string;
};

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

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Supabase not configured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const displayName = body.displayName?.trim() || null;
  const email = body.email?.trim() || null;
  const emailRemindersOptIn = Boolean(body.emailRemindersOptIn);

  const { data, error } = await admin
    .from("profiles")
    .upsert(
      {
        wallet_address: v.walletLower,
        display_name: displayName,
        email,
        email_reminders_opt_in: emailRemindersOptIn,
      },
      { onConflict: "wallet_address" }
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  return NextResponse.json({ profile: profileRowToClient(data) });
}

export async function DELETE(request: Request) {
  let body: { walletAddress?: string };
  try {
    body = (await request.json()) as { walletAddress?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const v = await verifyWalletSessionOrAuth(request, body);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: v.status });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Supabase not configured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const { error } = await admin
    .from("profiles")
    .delete()
    .eq("wallet_address", v.walletLower);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
