import { createHmac, timingSafeEqual } from "crypto";

export const WALLET_SESSION_COOKIE = "fairysplit_wallet_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

type SessionPayload = {
  walletLower: string;
  exp: number;
};

function getSessionSecret(): string {
  return (
    process.env.WALLET_AUTH_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "dev-insecure-wallet-session-secret"
  );
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(input: string): string {
  return createHmac("sha256", getSessionSecret()).update(input).digest("base64url");
}

export function createWalletSessionToken(walletLower: string): string {
  const payload: SessionPayload = {
    walletLower,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const body = encodeBase64Url(JSON.stringify(payload));
  const sig = sign(body);
  return `${body}.${sig}`;
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function readWalletSessionFromToken(token: string): SessionPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = sign(body);
  if (!safeEqual(sig, expected)) return null;

  let parsed: SessionPayload;
  try {
    parsed = JSON.parse(decodeBase64Url(body)) as SessionPayload;
  } catch {
    return null;
  }

  if (
    !parsed ||
    typeof parsed.walletLower !== "string" ||
    !/^0x[a-f0-9]{40}$/.test(parsed.walletLower) ||
    typeof parsed.exp !== "number"
  ) {
    return null;
  }

  if (Date.now() > parsed.exp) {
    return null;
  }

  return parsed;
}

export function getWalletSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}
