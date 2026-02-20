import { ethers } from "ethers";
import { ConfidentialTransferClient } from "@fairblock/stabletrust";
import { getUsdcContract } from "@/lib/usdc";
/**
 * Fairblock StableTrust — PLACEHOLDER for confidential payments.
 * See docs/CONFIDENTIALITY.md and https://www.npmjs.com/package/@fairblock/stabletrust
 *
 * In production: use ConfidentialTransferClient.confidentialTransfer()
 * then have verifier/relayer call markPaidConfidential on BillSplitter.
 */

// Uncomment when integrating:
// import { ConfidentialTransferClient } from "@fairblock/stabletrust";

const STABLETRUST_ADDRESSES: Record<number, string> = {
  84532: "0x73D2bc5B5c7aF5C3726E7bEf0BD8b4931923fdA9", // Base testnet
  1244: "0xf085e801a6FD9d03b09566a738734B7e2Bb065De", // Arc legacy chain id
  5042002: "0xf085e801a6FD9d03b09566a738734B7e2Bb065De", // Arc testnet app chain id
};

const STABLETRUST_RPCS: Record<number, string> = {
  84532: "https://sepolia.base.org",
  1244: "https://rpc.testnet.arc.network",
  5042002: "https://rpc.testnet.arc.network",
};

const STABLETRUST_CHAIN_IDS: Record<number, number> = {
  84532: 84532,
  1244: 1244,
  5042002: 5042002,
};

type ConfidentialKeys = {
  privateKey: string;
  publicKey: string;
};

export type ConfidentialStatus =
  | "awaiting_signature"
  | "creating_account"
  | "reading_balance"
  | "checking_recipient"
  | "depositing"
  | "transferring"
  | "withdrawing"
  | "finalizing"
  | "retrying";

type StatusHandler = (status: ConfidentialStatus) => void;

function keysScope(chainId: number): string {
  const contract = STABLETRUST_ADDRESSES[chainId];
  if (!contract) return `${chainId}_unknown`;
  return `${chainId}_${contract.toLowerCase()}`;
}

function keysStorageKey(chainId: number, address: string) {
  return `fairysplit_stabletrust_keys_${keysScope(chainId)}_${address.toLowerCase()}`;
}

function legacyKeysStorageKey(chainId: number, address: string) {
  return `fairysplit_stabletrust_keys_${chainId}_${address.toLowerCase()}`;
}

function getStoredKeys(chainId: number, address: string): ConfidentialKeys | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keysStorageKey(chainId, address));
    return raw ? (JSON.parse(raw) as ConfidentialKeys) : null;
  } catch {
    return null;
  }
}

function setStoredKeys(chainId: number, address: string, keys: ConfidentialKeys) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(keysStorageKey(chainId, address), JSON.stringify(keys));
  // Clean up legacy key shape so we don't accidentally use stale state later.
  window.localStorage.removeItem(legacyKeysStorageKey(chainId, address));
}

function getClient(chainId: number): ConfidentialTransferClient {
  const rpc = STABLETRUST_RPCS[chainId];
  const contractAddress = STABLETRUST_ADDRESSES[chainId];
  const sdkChainId = STABLETRUST_CHAIN_IDS[chainId];
  if (!rpc || !contractAddress || !sdkChainId) {
    throw new Error("Confidential transfer is not configured for this chain.");
  }
  return new ConfidentialTransferClient(rpc, contractAddress, sdkChainId);
}

function usdcRawToX100(amountRaw: bigint): number {
  const factor = BigInt(10000); // USDC 6 decimals -> x100 scale (2 decimals)
  if (amountRaw <= BigInt(0)) throw new Error("Amount must be greater than zero.");
  if (amountRaw % factor !== BigInt(0)) {
    throw new Error("Confidential amount supports up to 2 decimals.");
  }
  const scaled = amountRaw / factor;
  const asNum = Number(scaled);
  if (!Number.isSafeInteger(asNum)) {
    throw new Error("Amount too large for confidential transfer.");
  }
  return asNum;
}

function usdcDisplayToX100(displayAmount: string): number {
  const parsed = ethers.parseUnits(displayAmount || "0", 2);
  if (parsed <= BigInt(0)) throw new Error("Amount must be greater than zero.");
  const asNum = Number(parsed);
  if (!Number.isSafeInteger(asNum)) throw new Error("Amount too large.");
  return asNum;
}

function x100ToUsdcDisplay(amountX100: number): string {
  return (amountX100 / 100).toFixed(2);
}

function x100ToUsdcRaw(amountX100: number): bigint {
  return BigInt(amountX100) * BigInt(10000); // x100 -> 6 decimals
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out. Please retry.`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientConfidentialError(error: unknown): boolean {
  const msg =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();
  return (
    msg.includes("missing revert data") ||
    msg.includes("estimate gas") ||
    msg.includes("estimategas") ||
    msg.includes("call_exception") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("temporarily")
  );
}

function normalizeConfidentialError(error: unknown): Error {
  const raw = error instanceof Error ? error.message : String(error);
  const msg = raw.toLowerCase();

  if (msg.includes("has not been authorized yet")) {
    return new Error(
      "Wallet extension has not authorized localhost. Open the wallet extension, authorize http://localhost:3000, then retry."
    );
  }

  if (msg.includes("hydration failed")) {
    return new Error("App UI hydration failed. Refresh the page and retry the transaction.");
  }

  if (msg.includes("user rejected")) {
    return new Error("Transaction was rejected in wallet.");
  }

  if (msg.includes("insufficient allowance")) {
    return new Error(
      "USDC approval is missing or too low for confidential deposit. Approve USDC and retry."
    );
  }

  return error instanceof Error ? error : new Error(raw);
}

async function withRetry<T>(params: {
  action: () => Promise<T>;
  label: string;
  onStatus?: StatusHandler;
  retries?: number;
  onRetry?: (context: {
    nextAttempt: number;
    maxAttempts: number;
    error: unknown;
  }) => Promise<void> | void;
}): Promise<T> {
  const retries = params.retries ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await params.action();
    } catch (error) {
      lastError = error;
      const canRetry = attempt < retries && isTransientConfidentialError(error);
      if (!canRetry) break;
      params.onStatus?.("retrying");
      await params.onRetry?.({
        nextAttempt: attempt + 2,
        maxAttempts: retries + 1,
        error,
      });
      const delayMs = 1000 * Math.pow(2, attempt);
      await sleep(delayMs);
    }
  }

  throw normalizeConfidentialError(
    lastError instanceof Error ? lastError : new Error(`${params.label} failed.`)
  );
}

async function waitForAccountReady(
  client: ConfidentialTransferClient,
  address: string,
  onStatus?: StatusHandler
): Promise<boolean> {
  onStatus?.("finalizing");
  const attempts = 30;
  for (let i = 0; i < attempts; i++) {
    try {
      const info = await withTimeout(client.getAccountInfo(address), 30000, "Account readiness");
      if (info?.exists) return true;
    } catch {
      // Best-effort readiness polling only.
    }
    await sleep(2000);
  }
  return false;
}

export function hasStoredConfidentialKeys(chainId: number, address: string): boolean {
  return !!getStoredKeys(chainId, address);
}

async function ensureStableTrustAllowance(
  signer: ethers.Signer,
  tokenAddress: string,
  chainId: number,
  requiredX100: number,
  onStatus?: StatusHandler
): Promise<void> {
  const spender = STABLETRUST_ADDRESSES[chainId];
  if (!spender) {
    throw new Error("Confidential transfer is not configured for this chain.");
  }
  const owner = await signer.getAddress();
  const usdc = getUsdcContract(tokenAddress, signer);
  const requiredRaw = x100ToUsdcRaw(requiredX100);
  const allowance = (await usdc.allowance(owner, spender)) as bigint;
  if (allowance >= requiredRaw) return;

  onStatus?.("awaiting_signature");
  const maxApproval = ethers.MaxUint256;
  const approveTx = await withTimeout(
    usdc.approve(spender, maxApproval),
    120000,
    "USDC approval"
  );
  onStatus?.("finalizing");
  await withTimeout(approveTx.wait(), 180000, "USDC approval confirmation");
}

export async function getSignerAddress(signer: ethers.Signer): Promise<string> {
  return (await signer.getAddress()).toLowerCase();
}

export async function ensureConfidentialAccount(
  signer: ethers.Signer,
  chainId: number,
  onStatus?: StatusHandler
): Promise<ConfidentialKeys> {
  const address = (await signer.getAddress()).toLowerCase();
  const existing = getStoredKeys(chainId, address);
  if (existing) return existing;

  const client = getClient(chainId);
  onStatus?.("awaiting_signature");
  onStatus?.("creating_account");
  const keys = (await withRetry({
    label: "Account initialization",
    onStatus,
    retries: 0,
    action: () =>
      withTimeout(
        client.ensureAccount(signer, {
          waitForFinalization: false,
          maxAttempts: 30,
        }),
        120000,
        "Account initialization"
      ),
  })) as ConfidentialKeys;
  setStoredKeys(chainId, address, keys);
  // Base testnet may finalize/index slower than the SDK polling window.
  // Persist keys immediately and treat readiness as best-effort.
  await waitForAccountReady(client, address, onStatus);
  return keys;
}

export async function performConfidentialPayment(
  signer: ethers.Signer,
  recipient: string,
  tokenAddress: string,
  amountRaw: bigint,
  chainId: number,
  onStatus?: StatusHandler
): Promise<void> {
  if (!ethers.isAddress(recipient)) throw new Error("Recipient address is invalid.");

  const client = getClient(chainId);
  const senderKeys = await ensureConfidentialAccount(signer, chainId, onStatus);
  void senderKeys;

  // Receiver must initialize account at least once.
  onStatus?.("checking_recipient");
  const recipientInfo = await withTimeout(
    client.getAccountInfo(recipient),
    30000,
    "Recipient account check"
  );
  if (!recipientInfo?.exists) {
    throw new Error(
      "Recipient has no confidential account yet. Ask them to initialize Confidential Wallet first."
    );
  }

  const amountX100 = usdcRawToX100(amountRaw);

  onStatus?.("reading_balance");
  const senderAddress = (await signer.getAddress()).toLowerCase();
  const senderBalance = await withRetry({
    label: "Confidential balance read",
    onStatus,
    retries: 1,
    action: () =>
      withTimeout(
        client.getConfidentialBalance(senderAddress, senderKeys.privateKey, tokenAddress),
        60000,
        "Balance refresh"
      ),
  });

  // Use available cUSDC first; only deposit missing amount from public USDC if needed.
  const availableX100 = senderBalance.available.amount;
  const shortfallX100 = Math.max(0, amountX100 - availableX100);
  if (shortfallX100 > 0) {
    throw new Error(
      `Insufficient cUSDC for confidential payment. Need ${x100ToUsdcDisplay(
        shortfallX100
      )} more cUSDC. Open Confidential Wallet and convert USDC to cUSDC first.`
    );
  }
  onStatus?.("transferring");
  await withRetry({
    label: "Confidential transfer",
    onStatus,
    retries: 0,
    action: () =>
      withTimeout(
        client.confidentialTransfer(signer, recipient, tokenAddress, amountX100, {
          waitForFinalization: true,
        }),
        180000,
        "Confidential transfer"
      ),
  });
}

export async function depositUsdcToConfidential(
  signer: ethers.Signer,
  tokenAddress: string,
  displayAmount: string,
  chainId: number,
  onStatus?: StatusHandler
): Promise<void> {
  const client = getClient(chainId);
  await ensureConfidentialAccount(signer, chainId, onStatus);
  const amountX100 = usdcDisplayToX100(displayAmount);
  await ensureStableTrustAllowance(signer, tokenAddress, chainId, amountX100, onStatus);

  onStatus?.("depositing");
  await withRetry({
    label: "Confidential top up",
    onStatus,
    retries: 0,
    action: () =>
      withTimeout(
        client.confidentialDeposit(signer, tokenAddress, amountX100, {
          waitForFinalization: true,
        }),
        180000,
        "Confidential top up"
      ),
  });
}

export async function getConfidentialBalanceSummary(
  signer: ethers.Signer,
  tokenAddress: string,
  chainId: number,
  onStatus?: StatusHandler
): Promise<{ total: number; available: number; pending: number }> {
  const client = getClient(chainId);
  const address = (await signer.getAddress()).toLowerCase();
  const keys = getStoredKeys(chainId, address);
  if (!keys) {
    throw new Error("Initialize confidential account first.");
  }
  onStatus?.("reading_balance");
  const balance = await withTimeout(
    client.getConfidentialBalance(address, keys.privateKey, tokenAddress),
    60000,
    "Balance refresh"
  );
  return {
    total: balance.amount / 100,
    available: balance.available.amount / 100,
    pending: balance.pending.amount / 100,
  };
}

export async function withdrawConfidentialToUsdc(
  signer: ethers.Signer,
  tokenAddress: string,
  displayAmount: string,
  chainId: number,
  onStatus?: StatusHandler
): Promise<void> {
  const client = getClient(chainId);
  const address = (await signer.getAddress()).toLowerCase();
  if (!getStoredKeys(chainId, address)) {
    throw new Error("Initialize confidential account first.");
  }
  const amountX100 = usdcDisplayToX100(displayAmount);
  onStatus?.("withdrawing");
  await withRetry({
    label: "Confidential withdraw",
    onStatus,
    retries: 0,
    action: () =>
      withTimeout(
        client.withdraw(signer, tokenAddress, amountX100, {
          waitForFinalization: true,
        }),
        180000,
        "Confidential withdraw"
      ),
  });
}

export { STABLETRUST_ADDRESSES };
