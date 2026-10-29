/**
 * EIP-191 message for authenticated API routes (profile, friends, cloud pull, etc.).
 */

export const WALLET_AUTH_MAX_AGE_MS = 10 * 60 * 1000;

const PREFIX = "FairySplit authenticated action";

export function buildWalletAuthMessage(walletAddress: string): string {
  const wallet = walletAddress.toLowerCase();
  const issuedAt = new Date().toISOString();
  return `${PREFIX}\nWallet: ${wallet}\nIssued at: ${issuedAt}`;
}

export type ParsedWalletAuth = {
  walletLower: string;
  issuedAt: Date;
};

export function parseWalletAuthMessage(message: string): ParsedWalletAuth | null {
  const lines = message.trim().split("\n");
  if (lines.length < 3 || lines[0].trim() !== PREFIX) return null;
  const walletLine = lines[1]?.trim() ?? "";
  const issuedLine = lines[2]?.trim() ?? "";
  if (!walletLine.startsWith("Wallet: ")) return null;
  if (!issuedLine.startsWith("Issued at: ")) return null;
  const walletLower = walletLine.slice("Wallet: ".length).trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(walletLower)) return null;
  const iso = issuedLine.slice("Issued at: ".length).trim();
  const issuedAt = new Date(iso);
  if (Number.isNaN(issuedAt.getTime())) return null;
  return { walletLower, issuedAt };
}

export function isWalletAuthFresh(issuedAt: Date, now = Date.now()): boolean {
  return Math.abs(now - issuedAt.getTime()) <= WALLET_AUTH_MAX_AGE_MS;
}
