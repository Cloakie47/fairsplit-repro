import { NextResponse } from "next/server";

import { verifyWalletAuth, type WalletAuthBody } from "@/lib/verify-wallet-auth";
import {
  createWalletSessionToken,
  getWalletSessionCookieOptions,
  WALLET_SESSION_COOKIE,
} from "@/lib/wallet-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: WalletAuthBody;
  try {
    body = (await request.json()) as WalletAuthBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const v = await verifyWalletAuth(body);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: v.status });
  }

  const token = createWalletSessionToken(v.walletLower);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(WALLET_SESSION_COOKIE, token, getWalletSessionCookieOptions());
  return response;
}
