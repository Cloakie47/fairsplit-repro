import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  activityRowToClient,
  friendRowToClient,
  notificationRowToClient,
  profileRowToClient,
  splitRequestRowToClient,
} from "@/lib/supabase-mappers";
import { verifyWalletSessionOrAuth } from "@/lib/verify-wallet-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

  const w = v.walletLower;

  const [
    profileRes,
    friendsRes,
    activityRes,
    requestsRes,
    notificationsRes,
  ] = await Promise.all([
    admin.from("profiles").select("*").eq("wallet_address", w).maybeSingle(),
    admin.from("friends").select("*").eq("owner_address", w),
    admin
      .from("activity_items")
      .select("*")
      .eq("wallet_address", w)
      .order("timestamp_ms", { ascending: false }),
    admin
      .from("split_requests")
      .select("*")
      .or(`creator_address.eq.${w},participant_address.eq.${w}`),
    admin
      .from("notifications")
      .select("*")
      .eq("user_address", w)
      .order("created_at_ms", { ascending: false }),
  ]);

  const errors = [
    profileRes.error,
    friendsRes.error,
    activityRes.error,
    requestsRes.error,
    notificationsRes.error,
  ].filter(Boolean);
  if (errors.length) {
    return NextResponse.json(
      { error: errors[0]!.message },
      { status: 503 }
    );
  }

  const profile = profileRes.data
    ? profileRowToClient(profileRes.data)
    : null;

  const friends = (friendsRes.data ?? []).map(friendRowToClient);
  const activity = (activityRes.data ?? []).map(activityRowToClient);
  const splitRequests = (requestsRes.data ?? []).map(splitRequestRowToClient);
  const notifications = (notificationsRes.data ?? []).map(
    notificationRowToClient
  );

  return NextResponse.json({
    profile,
    friends,
    activity,
    splitRequests,
    notifications,
  });
}
