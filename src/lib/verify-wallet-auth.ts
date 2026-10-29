import { getAddress, isAddress, verifyMessage } from "viem";

import {
  isWalletAuthFresh,
  parseWalletAuthMessage,
} from "@/lib/wallet-auth-message";
import {
  readWalletSessionFromToken,
  WALLET_SESSION_COOKIE,
} from "@/lib/wallet-session";

export type WalletAuthBody = {
  walletAddress: string;
  message: string;
  signature: string;
};

export async function verifyWalletAuth(
  body: WalletAuthBody
): Promise<
  { ok: true; walletLower: string } | { ok: false; status: number; error: string }
> {
  const { walletAddress, message, signature } = body;
  if (
    !walletAddress ||
    !message ||
    !signature ||
    typeof signature !== "string" ||
    !signature.startsWith("0x")
  ) {
    return {
      ok: false,
      status: 400,
      error: "Missing walletAddress, message, or signature",
    };
  }

  if (!isAddress(walletAddress)) {
    return { ok: false, status: 400, error: "Invalid walletAddress" };
  }

  const parsed = parseWalletAuthMessage(message);
  if (!parsed) {
    return { ok: false, status: 400, error: "Invalid message format" };
  }

  if (!isWalletAuthFresh(parsed.issuedAt)) {
    return { ok: false, status: 401, error: "Message expired; try again" };
  }

  const signerLower = getAddress(walletAddress).toLowerCase();
  if (parsed.walletLower !== signerLower) {
    return { ok: false, status: 401, error: "Message wallet mismatch" };
  }

  const valid = await verifyMessage({
    address: getAddress(walletAddress),
    message,
    signature: signature as `0x${string}`,
  });

  if (!valid) {
    return { ok: false, status: 401, error: "Invalid signature" };
  }

  return { ok: true, walletLower: signerLower };
}

function readCookieValue(cookieHeader: string, key: string): string | null {
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey !== key) continue;
    return rest.join("=");
  }
  return null;
}

export async function verifyWalletSessionOrAuth(
  request: Request,
  body?: Partial<WalletAuthBody>
): Promise<
  { ok: true; walletLower: string } | { ok: false; status: number; error: string }
> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  if (cookieHeader) {
    const sessionToken = readCookieValue(cookieHeader, WALLET_SESSION_COOKIE);
    if (sessionToken) {
      const session = readWalletSessionFromToken(sessionToken);
      if (session) {
        if (
          body?.walletAddress &&
          isAddress(body.walletAddress) &&
          getAddress(body.walletAddress).toLowerCase() !== session.walletLower
        ) {
          return {
            ok: false,
            status: 403,
            error: "Session wallet mismatch",
          };
        }
        return { ok: true, walletLower: session.walletLower };
      }
    }
  }

  if (body?.walletAddress && body?.message && body?.signature) {
    return verifyWalletAuth({
      walletAddress: body.walletAddress,
      message: body.message,
      signature: body.signature,
    });
  }

  return {
    ok: false,
    status: 401,
    error: "Wallet session missing; reconnect wallet to continue",
  };
}
