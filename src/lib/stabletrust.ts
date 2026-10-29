import { ethers } from "ethers";
import {
  ConfidentialTransferClient,
  getStabletrustContractAddress as getStableTrustContractAddress,
} from "@fairblock/stabletrust";
import { getUsdcContract } from "@/lib/usdc";
/**
 * Fairblock StableTrust — confidential payments via @fairblock/stabletrust.
 * See docs/CONFIDENTIALITY.md and https://github.com/Fairblock/stabletrust-sdk
 *
 * Contract addresses follow `getStableTrustContractAddress` from the SDK so
 * approvals, EIP-712 domain, and on-chain calls stay aligned when the package updates.
 *
 * Uses ConfidentialTransferClient.confidentialTransfer(); creator/relayer can
 * call markPaidConfidential on FairsplitV2 after settlement.
 */

const TEMPO_STABLETRUST_ADDRESS =
  process.env.NEXT_PUBLIC_TEMPO_STABLETRUST_ADDRESS;

/** ARC wallet chain id. */
const ARC_APP_CHAIN_ID = 5042002;
/**
 * SDK registry key for ARC. SDK <2.0 keyed ARC as 1244; 2.x keys it by the
 * wallet chain id, so this is now the same value as ARC_APP_CHAIN_ID.
 */
const ARC_CANONICAL_CHAIN_ID = 5042002;
const TEMPO_CHAIN_ID = 42431;

/**
 * Resolved StableTrust proxy address for this app's chain id (spender + client target).
 */
function resolveStableTrustContractAddress(chainId: number): string | null {
  if (chainId === ARC_APP_CHAIN_ID) {
    return getStableTrustContractAddress(ARC_CANONICAL_CHAIN_ID);
  }
  if (
    chainId === TEMPO_CHAIN_ID &&
    TEMPO_STABLETRUST_ADDRESS &&
    ethers.isAddress(TEMPO_STABLETRUST_ADDRESS)
  ) {
    return TEMPO_STABLETRUST_ADDRESS;
  }
  return getStableTrustContractAddress(chainId);
}

const STABLETRUST_LEGACY_ADDRESSES: Record<number, string[]> = {
  84532: [
    "0x962a8A7CD28BfFBb17C4F6Ec388782cca3ffd618",
    "0x6FE45A71F5232a4E5e583Ae31A538360fB1e6aDb",
    // Superseded by SDK 2.x; balances deposited under 1.x live here.
    "0xFBEa2AbCf1208E09dd90266fE94Fb76d8BfC34d9",
  ],
  1244: [
    "0xb20aB54e1c6AE55B0DD11FEB7FFf3fF1E9631f19",
    "0xf085e801a6FD9d03b09566a738734B7e2Bb065De",
  ],
  5042002: [
    "0xb20aB54e1c6AE55B0DD11FEB7FFf3fF1E9631f19",
    "0xf085e801a6FD9d03b09566a738734B7e2Bb065De",
    // Superseded by SDK 2.x; balances deposited under 1.x live here.
    "0x5d43CE5269Cd46badC67B3664369862F20eC5649",
  ],
};

/**
 * Ordered RPC endpoints per chain. The first entry is preferred; later entries
 * are fallbacks used after a transient transport failure (see rotateRpc).
 * A single rate-limited endpoint is enough to make confidential payments look
 * broken, so every chain that can have a fallback has one.
 */
const STABLETRUST_RPCS: Record<number, readonly string[]> = {
  84532: [
    "https://sepolia.base.org",
    "https://base-sepolia-rpc.publicnode.com",
    "https://base-sepolia.drpc.org",
  ],
  1244: ["https://rpc.testnet.arc.network"],
  5042002: ["https://rpc.testnet.arc.network"],
  42431: ["https://rpc.moderato.tempo.xyz"],
};

/** Which endpoint in STABLETRUST_RPCS[chainId] is currently in use. */
const rpcCursor: Record<number, number> = {};

function currentRpc(chainId: number): string | undefined {
  const endpoints = STABLETRUST_RPCS[chainId];
  if (!endpoints?.length) return undefined;
  return endpoints[(rpcCursor[chainId] ?? 0) % endpoints.length];
}

/**
 * Advances to the next endpoint for this chain. Returns false when there is
 * nothing to rotate to, so callers can stop retrying on transport errors.
 */
function rotateRpc(chainId: number): boolean {
  const endpoints = STABLETRUST_RPCS[chainId];
  if (!endpoints || endpoints.length < 2) return false;
  rpcCursor[chainId] = ((rpcCursor[chainId] ?? 0) + 1) % endpoints.length;
  return true;
}

const STABLETRUST_CHAIN_IDS: Record<number, number> = {
  84532: 84532,
  1244: 1244,
  // Must match the connected wallet chain for eth_signTypedData_v4.
  5042002: 5042002,
  42431: 42431,
};

type ConfidentialKeys = {
  privateKey: string;
  publicKey: string;
};

export type ConfidentialPreflightSummary = {
  address: string;
  availableCusdc?: number;
  pendingCusdc?: number;
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

export function isConfidentialTransferConfigured(chainId?: number): boolean {
  if (!chainId) return false;
  return (
    !!resolveStableTrustContractAddress(chainId) &&
    !!currentRpc(chainId) &&
    STABLETRUST_CHAIN_IDS[chainId] !== undefined
  );
}

function isValidConfidentialKeys(value: unknown): value is ConfidentialKeys {
  if (!value || typeof value !== "object") return false;
  const maybe = value as Partial<ConfidentialKeys>;
  return (
    typeof maybe.privateKey === "string" &&
    maybe.privateKey.length > 0 &&
    typeof maybe.publicKey === "string" &&
    maybe.publicKey.length > 0
  );
}

function keysScope(chainId: number, contractAddress?: string): string {
  const contract =
    contractAddress ?? resolveStableTrustContractAddress(chainId) ?? null;
  if (!contract) return `${chainId}_unknown`;
  return `${chainId}_${contract.toLowerCase()}`;
}

function keysStorageKey(
  chainId: number,
  address: string,
  contractAddress?: string,
) {
  return `fairysplit_stabletrust_keys_${keysScope(
    chainId,
    contractAddress,
  )}_${address.toLowerCase()}`;
}

function legacyKeysStorageKey(chainId: number, address: string) {
  return `fairysplit_stabletrust_keys_${chainId}_${address.toLowerCase()}`;
}

function getStoredKeys(
  chainId: number,
  address: string,
  contractAddress?: string,
): ConfidentialKeys | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      keysStorageKey(chainId, address, contractAddress),
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isValidConfidentialKeys(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getLegacyUnscopedStoredKeys(
  chainId: number,
  address: string,
): ConfidentialKeys | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      legacyKeysStorageKey(chainId, address),
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isValidConfidentialKeys(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function setStoredKeys(
  chainId: number,
  address: string,
  keys: ConfidentialKeys,
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    keysStorageKey(chainId, address),
    JSON.stringify(keys),
  );
  // Clean up legacy key shape so we don't accidentally use stale state later.
  window.localStorage.removeItem(legacyKeysStorageKey(chainId, address));
}

function clearStoredKeys(chainId: number, address: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(keysStorageKey(chainId, address));
  window.localStorage.removeItem(legacyKeysStorageKey(chainId, address));
}

function getLegacyContractAddresses(chainId: number): string[] {
  const configured = STABLETRUST_LEGACY_ADDRESSES[chainId] ?? [];
  const active = resolveStableTrustContractAddress(chainId)?.toLowerCase();
  return configured.filter((address, idx) => {
    const normalized = address.toLowerCase();
    return (
      normalized !== active &&
      configured.findIndex((x) => x.toLowerCase() === normalized) === idx
    );
  });
}

function isLikelyDecryptionFailure(error: unknown): boolean {
  const msg =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();
  return (
    msg.includes("decryption failed") || msg.includes("private key is required")
  );
}

function getClient(
  chainId: number,
  contractAddressOverride?: string,
): ConfidentialTransferClient {
  const rpc = currentRpc(chainId);
  const walletChainId = STABLETRUST_CHAIN_IDS[chainId];
  if (!rpc || walletChainId === undefined) {
    throw new Error("Confidential transfer is not configured for this chain.");
  }

  if (contractAddressOverride) {
    return new ConfidentialTransferClient(
      rpc,
      contractAddressOverride,
      walletChainId,
    );
  }

  if (chainId === ARC_APP_CHAIN_ID) {
    const contract = getStableTrustContractAddress(ARC_CANONICAL_CHAIN_ID);
    if (!contract) {
      throw new Error("Confidential transfer is not configured for this chain.");
    }
    return new ConfidentialTransferClient(rpc, contract, walletChainId);
  }

  if (
    chainId === TEMPO_CHAIN_ID &&
    TEMPO_STABLETRUST_ADDRESS &&
    ethers.isAddress(TEMPO_STABLETRUST_ADDRESS)
  ) {
    return new ConfidentialTransferClient(
      rpc,
      TEMPO_STABLETRUST_ADDRESS,
      walletChainId,
    );
  }

  if (getStableTrustContractAddress(walletChainId)) {
    return new ConfidentialTransferClient(rpc, walletChainId);
  }

  throw new Error("Confidential transfer is not configured for this chain.");
}

function usdcRawToX100(amountRaw: bigint): bigint {
  if (amountRaw <= BigInt(0))
    throw new Error("Amount must be greater than zero.");
  // Keep raw token units (USDC 6 decimals) for SDK operations.
  return amountRaw;
}

function usdcDisplayToX100(displayAmount: string): bigint {
  // Parse user-facing USDC input into raw token units (6 decimals).
  const parsed = ethers.parseUnits(displayAmount || "0", 6);
  if (parsed <= BigInt(0)) throw new Error("Amount must be greater than zero.");
  return parsed;
}

function x100ToUsdcNumber(amountX100: bigint): number {
  const formatted = ethers.formatUnits(amountX100, 6);
  const asNum = Number(formatted);
  if (!Number.isFinite(asNum))
    throw new Error("Amount too large to display safely.");
  return asNum;
}

function x100ToUsdcDisplay(amountX100: bigint): string {
  return x100ToUsdcNumber(amountX100).toFixed(2);
}

function x100ToUsdcRaw(amountX100: bigint): bigint {
  // Value is already in raw token units.
  return amountX100;
}

function toSdkAmount(amountX100: bigint): number {
  const asNum = Number(amountX100);
  if (!Number.isSafeInteger(asNum)) {
    throw new Error("Amount too large for SDK call.");
  }
  return asNum;
}

function asBigIntAmount(value: bigint | number | string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new Error("Unexpected confidential balance format.");
  }
}

function extractTxHash(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as
    | {
        hash?: unknown;
        txHash?: unknown;
        transactionHash?: unknown;
        txReceipt?: { transactionHash?: unknown };
      }
    | undefined;
  const direct =
    candidate?.hash ?? candidate?.txHash ?? candidate?.transactionHash;
  if (typeof direct === "string" && direct.startsWith("0x")) return direct;
  const fromReceipt = candidate?.txReceipt?.transactionHash;
  if (typeof fromReceipt === "string" && fromReceipt.startsWith("0x"))
    return fromReceipt;
  return undefined;
}

async function waitForTxIfNeeded(value: unknown): Promise<unknown> {
  if (
    value &&
    typeof value === "object" &&
    "wait" in (value as object) &&
    typeof (value as { wait?: () => Promise<unknown> }).wait === "function"
  ) {
    return (value as { wait: () => Promise<unknown> }).wait();
  }
  return value;
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out. Please retry.`)),
      ms,
    );
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
      "Wallet extension has not authorized localhost. Open the wallet extension, authorize http://localhost:3000, then retry.",
    );
  }

  if (msg.includes("hydration failed")) {
    return new Error(
      "App UI hydration failed. Refresh the page and retry the transaction.",
    );
  }

  if (msg.includes("user rejected")) {
    return new Error("Transaction was rejected in wallet.");
  }

  if (msg.includes("insufficient allowance")) {
    return new Error(
      "Token approval is missing or too low for confidential deposit. Approve the selected token and retry.",
    );
  }

  if (
    msg.includes("pinata jwt is not set") ||
    msg.includes("react_app_pinata_jwt is not set") ||
    msg.includes("failed to upload proof to ipfs")
  ) {
    return new Error(
      "Tempo confidential transfers need a Pinata JWT for proof uploads. Add `PINATA_JWT` to your `.env.local` (or `NEXT_PUBLIC_PINATA_JWT`), restart `npm run dev`, and retry.",
    );
  }

  return error instanceof Error ? error : new Error(raw);
}

async function withRetry<T>(params: {
  action: () => Promise<T>;
  label: string;
  onStatus?: StatusHandler;
  retries?: number;
  /** When set, a transient failure rotates this chain's RPC endpoint. */
  chainId?: number;
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
      const transient = isTransientConfidentialError(error);
      if (transient && params.chainId !== undefined) {
        // Abandon an unhealthy endpoint for the rest of the session rather than
        // hammering it; the next client build picks up the rotated URL.
        rotateRpc(params.chainId);
      }
      const canRetry = attempt < retries && transient;
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
    lastError instanceof Error
      ? lastError
      : new Error(`${params.label} failed.`),
  );
}

/**
 * Like withRetry, but rebuilds the client on each attempt so a transient
 * transport failure is retried against the *next* RPC endpoint rather than the
 * one that just failed. Use this for any new confidential call path.
 */
async function withClientRetry<T>(params: {
  chainId: number;
  label: string;
  onStatus?: StatusHandler;
  action: (client: ConfidentialTransferClient) => Promise<T>;
  contractAddressOverride?: string;
}): Promise<T> {
  const endpoints = STABLETRUST_RPCS[params.chainId]?.length ?? 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < endpoints; attempt++) {
    try {
      return await params.action(
        getClient(params.chainId, params.contractAddressOverride),
      );
    } catch (error) {
      lastError = error;
      if (!isTransientConfidentialError(error)) break;
      if (!rotateRpc(params.chainId)) break;
      params.onStatus?.("retrying");
      await sleep(600);
    }
  }

  throw normalizeConfidentialError(
    lastError instanceof Error
      ? lastError
      : new Error(`${params.label} failed.`),
  );
}

/**
 * Account readiness polling. Base Sepolia finalizes confidential accounts well
 * outside the SDK's own polling window, so we poll the contract ourselves.
 * 90 x 2s = 180s. Account initialization is a one-time onboarding step with a
 * progress indicator, never part of checkout, so a long ceiling is cheap.
 */
const ACCOUNT_READY_POLL_ATTEMPTS = 90;
const ACCOUNT_READY_POLL_INTERVAL_MS = 2000;

/**
 * The SDK default is 225 attempts x 400ms (~90s). The previous override of 30
 * gave up after ~12s, far too short for this chain, which surfaced as a
 * spurious "finalization timeout" on accounts that had been created fine.
 */
const SDK_ENSURE_ACCOUNT_MAX_ATTEMPTS = 225;

async function waitForAccountReady(
  client: ConfidentialTransferClient,
  address: string,
  onStatus?: StatusHandler,
): Promise<boolean> {
  onStatus?.("finalizing");
  for (let i = 0; i < ACCOUNT_READY_POLL_ATTEMPTS; i++) {
    try {
      const info = await withTimeout(
        client.getAccountInfo(address),
        30000,
        "Account readiness",
      );
      if (info?.exists && info?.finalized) return true;
    } catch {
      // Best-effort readiness polling only.
    }
    await sleep(ACCOUNT_READY_POLL_INTERVAL_MS);
  }
  return false;
}

export function hasStoredConfidentialKeys(
  chainId: number,
  address: string,
): boolean {
  return !!getStoredKeys(chainId, address);
}

async function refreshStoredKeysFromSigner(
  signer: ethers.Signer,
  chainId: number,
): Promise<{ address: string; keys: ConfidentialKeys }> {
  const client = getClient(chainId);
  const address = (await signer.getAddress()).toLowerCase();
  const refreshed = await withRetry({
    label: "Account initialization",
    retries: 0,
    action: () =>
      withTimeout(
        client.ensureAccount(signer, {
          waitForFinalization: false,
          maxAttempts: SDK_ENSURE_ACCOUNT_MAX_ATTEMPTS,
        }),
        120000,
        "Account initialization",
      ),
  });
  if (!isValidConfidentialKeys(refreshed)) {
    throw new Error(
      "Unable to recover confidential keys. Re-initialize account and retry.",
    );
  }
  setStoredKeys(chainId, address, refreshed);
  return { address, keys: refreshed };
}

async function readLegacyBalanceIfPresent(
  signer: ethers.Signer,
  tokenAddress: string,
  chainId: number,
): Promise<boolean> {
  const address = (await signer.getAddress()).toLowerCase();
  const legacyUnscopedKeys = getLegacyUnscopedStoredKeys(chainId, address);
  for (const legacyContract of getLegacyContractAddresses(chainId)) {
    const legacyKeys =
      getStoredKeys(chainId, address, legacyContract) ?? legacyUnscopedKeys;
    if (!legacyKeys) continue;
    try {
      const legacyClient = getClient(chainId, legacyContract);
      const account = await withTimeout(
        legacyClient.getAccountInfo(address),
        30000,
        "Legacy account check",
      );
      if (!account?.exists) continue;
      const legacyBalance = await withTimeout(
        legacyClient.getConfidentialBalance(
          address,
          legacyKeys.privateKey,
          tokenAddress,
        ),
        60000,
        "Legacy balance refresh",
      );
      if (asBigIntAmount(legacyBalance.amount) > BigInt(0)) return true;
    } catch {
      // Best-effort migration signal only.
    }
  }
  return false;
}

async function ensureStableTrustAllowance(
  signer: ethers.Signer,
  tokenAddress: string,
  chainId: number,
  requiredX100: bigint,
  onStatus?: StatusHandler,
): Promise<void> {
  const spender = resolveStableTrustContractAddress(chainId);
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
    "USDC approval",
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
  onStatus?: StatusHandler,
): Promise<ConfidentialKeys> {
  const address = (await signer.getAddress()).toLowerCase();
  const existing = getStoredKeys(chainId, address);
  if (existing) return existing;

  const client = getClient(chainId);
  onStatus?.("awaiting_signature");
  onStatus?.("creating_account");
  const derived = await withRetry({
    label: "Account initialization",
    onStatus,
    retries: 0,
    action: () =>
      withTimeout(
        client.ensureAccount(signer, {
          waitForFinalization: false,
          maxAttempts: SDK_ENSURE_ACCOUNT_MAX_ATTEMPTS,
        }),
        120000,
        "Account initialization",
      ),
  });
  if (!isValidConfidentialKeys(derived)) {
    clearStoredKeys(chainId, address);
    throw new Error(
      "Failed to derive confidential keys. Please retry initialization.",
    );
  }
  setStoredKeys(chainId, address, derived);
  // Base testnet may finalize/index slower than the SDK polling window.
  // Persist keys immediately, but require finalization before returning success.
  const ready = await waitForAccountReady(client, address, onStatus);
  if (!ready) {
    throw new Error(
      "Confidential account was created but is not finalized yet. Wait a moment and retry."
    );
  }
  return derived;
}

async function requireLocalKeysAndAccountReady(
  signer: ethers.Signer,
  chainId: number,
  _onStatus?: StatusHandler,
): Promise<{
  client: ConfidentialTransferClient;
  address: string;
  keys: ConfidentialKeys;
}> {
  const client = getClient(chainId);
  const address = (await signer.getAddress()).toLowerCase();
  const keys = getStoredKeys(chainId, address);
  if (!keys) {
    throw new Error("Initialize confidential account first.");
  }
  const accountInfo = await withTimeout(
    client.getAccountInfo(address),
    30000,
    "Confidential account check",
  );
  if (!accountInfo?.exists) {
    throw new Error(
      "Confidential account is still finalizing. Wait a moment, then retry.",
    );
  }
  if (!accountInfo?.finalized) {
    throw new Error(
      "Confidential account is not finalized yet. Please wait a moment and retry.",
    );
  }
  return { client, address, keys };
}

export async function preflightConfidentialPayment(
  signer: ethers.Signer,
  recipient: string,
  tokenAddress: string,
  amountRaw: bigint,
  chainId: number,
): Promise<ConfidentialPreflightSummary> {
  if (!ethers.isAddress(recipient))
    throw new Error("Recipient address is invalid.");
  const { client, address, keys } = await requireLocalKeysAndAccountReady(
    signer,
    chainId,
  );

  const recipientInfo = await withTimeout(
    client.getAccountInfo(recipient),
    30000,
    "Recipient account check",
  );
  if (!recipientInfo?.exists) {
    throw new Error(
      "Recipient has no confidential account yet. Ask them to initialize Confidential Wallet first.",
    );
  }

  const amountX100 = usdcRawToX100(amountRaw);
  const balance = await withTimeout(
    client.getConfidentialBalance(address, keys.privateKey, tokenAddress),
    60000,
    "Balance refresh",
  );
  const availableX100 = asBigIntAmount(balance.available.amount);
  const shortfallX100 =
    amountX100 > availableX100 ? amountX100 - availableX100 : BigInt(0);
  if (shortfallX100 > BigInt(0)) {
    throw new Error(
      `Insufficient confidential balance for payment. Need ${x100ToUsdcDisplay(
        shortfallX100,
      )} more. Open Confidential Wallet and convert more of the selected token first.`,
    );
  }
  return {
    address,
    availableCusdc: x100ToUsdcNumber(asBigIntAmount(balance.available.amount)),
    pendingCusdc: x100ToUsdcNumber(asBigIntAmount(balance.pending.amount)),
  };
}

/**
 * Why the confidential option is or is not offerable for one payment.
 *
 * `service_unavailable` exists to avoid blaming a user for an upstream outage.
 * StableTrust accounts only become usable once Fairblock's off-chain operator
 * processes the CreateAccountRequested event and flips `finalized`. An account
 * that exists but is not finalized means the request is sitting unprocessed —
 * nothing the payer or the merchant can do about it. Reporting that as
 * "recipient not initialised" would be wrong and would read as the user's
 * fault. The gate re-checks on every call, so the option lights up again on
 * its own when the operator resumes. There is no manual flag.
 */
export type ConfidentialGateReason =
  | "ready"
  | "chain_unsupported"
  | "recipient_not_initialized"
  | "payer_not_initialized"
  | "service_unavailable"
  | "insufficient_confidential_balance"
  | "insufficient_native_for_fee";

export type ConfidentialGateResult = {
  ok: boolean;
  reason: ConfidentialGateReason;
  /** Already phrased for display next to the toggle. */
  message: string;
  /** True when the blocker is upstream and the user can do nothing about it. */
  upstream: boolean;
  /** True when the user can resolve it (deposit, initialise, fund gas). */
  actionable: boolean;
  availableUsdc?: number;
  shortfallUsdc?: number;
};

function gate(
  reason: ConfidentialGateReason,
  message: string,
  extra: Partial<ConfidentialGateResult> = {},
): ConfidentialGateResult {
  return {
    ok: reason === "ready",
    reason,
    message,
    upstream: reason === "service_unavailable",
    actionable:
      reason === "recipient_not_initialized" ||
      reason === "payer_not_initialized" ||
      reason === "insufficient_confidential_balance" ||
      reason === "insufficient_native_for_fee",
    ...extra,
  };
}

/**
 * Non-throwing gate for a confidential payment. Returns a verdict to render
 * rather than an error to catch, so checkout can show the real reason without
 * a failed submit. Never throws: an unexpected or transient failure degrades
 * to `service_unavailable` rather than inventing a user-facing fault.
 *
 * Checks, in order: chain support, payer keys, payer account finalized,
 * recipient account finalized, native balance for the payable protocol fee,
 * then spendable confidential balance.
 */
export async function checkConfidentialPaymentGate(params: {
  signer: ethers.Signer;
  recipient: string;
  tokenAddress: string;
  amountRaw: bigint;
  chainId: number;
}): Promise<ConfidentialGateResult> {
  const { signer, recipient, tokenAddress, amountRaw, chainId } = params;

  if (!isConfidentialTransferConfigured(chainId)) {
    return gate(
      "chain_unsupported",
      "Confidential payment is not available on this network.",
    );
  }
  if (!ethers.isAddress(recipient)) {
    return gate(
      "recipient_not_initialized",
      "This merchant has no valid payout address for confidential payment.",
    );
  }

  try {
    const address = (await signer.getAddress()).toLowerCase();

    if (!hasStoredConfidentialKeys(chainId, address)) {
      return gate(
        "payer_not_initialized",
        "Set up confidential payments in your profile first. It takes about a minute and only has to be done once.",
      );
    }

    const keys = getStoredKeys(chainId, address);
    if (!keys) {
      return gate(
        "payer_not_initialized",
        "Set up confidential payments in your profile first. It takes about a minute and only has to be done once.",
      );
    }

    const [payerInfo, recipientInfo] = await withClientRetry({
      chainId,
      label: "Confidential account check",
      action: (client) =>
        Promise.all([
          withTimeout(
            client.getAccountInfo(address),
            30000,
            "Payer account check",
          ),
          withTimeout(
            client.getAccountInfo(recipient),
            30000,
            "Recipient account check",
          ),
        ]),
    });

    // Not requested at all -> the account owner can fix it.
    if (!recipientInfo?.exists) {
      return gate(
        "recipient_not_initialized",
        "This merchant has not set up confidential payments yet. Paying normally instead.",
      );
    }
    if (!payerInfo?.exists) {
      return gate(
        "payer_not_initialized",
        "Set up confidential payments in your profile first. It takes about a minute and only has to be done once.",
      );
    }

    // Requested but unprocessed -> upstream outage, not anyone's fault here.
    if (!recipientInfo?.finalized || !payerInfo?.finalized) {
      return gate(
        "service_unavailable",
        "Confidential payment is temporarily unavailable. Paying normally instead; the amount will be visible on-chain.",
      );
    }

    // 2.x transfers are payable: a fixed protocol fee is charged in the
    // configured fee token, which is the native currency when it is address(0).
    const provider =
      signer.provider ??
      new ethers.JsonRpcProvider(currentRpc(chainId), chainId, {
        staticNetwork: true,
      });
    const nativeBalance = await provider.getBalance(address);
    if (nativeBalance <= BigInt(0)) {
      return gate(
        "insufficient_native_for_fee",
        "You need a small amount of ETH on this network to cover the confidential transfer fee and gas.",
      );
    }

    const amountX100 = usdcRawToX100(amountRaw);
    const balance = await withClientRetry({
      chainId,
      label: "Confidential balance read",
      action: (client) =>
        withTimeout(
          client.getConfidentialBalance(address, keys.privateKey, tokenAddress),
          60000,
          "Balance refresh",
        ),
    });
    const availableX100 = asBigIntAmount(balance.available.amount);
    const availableUsdc = x100ToUsdcNumber(availableX100);

    if (amountX100 > availableX100) {
      const shortfallX100 = amountX100 - availableX100;
      return gate(
        "insufficient_confidential_balance",
        `Add ${x100ToUsdcDisplay(
          shortfallX100,
        )} USDC to your confidential balance to pay this order privately.`,
        { availableUsdc, shortfallUsdc: x100ToUsdcNumber(shortfallX100) },
      );
    }

    return gate("ready", "Amount and balance encrypted on-chain.", {
      availableUsdc,
    });
  } catch (error) {
    // Transport flakiness, a decryption failure, an unexpected SDK error: all
    // degrade the same way. Never surface this as something the user did.
    void error;
    return gate(
      "service_unavailable",
      "Confidential payment is temporarily unavailable. Paying normally instead; the amount will be visible on-chain.",
    );
  }
}

export async function preflightConfidentialTopUp(
  signer: ethers.Signer,
  tokenAddress: string,
  displayAmount: string,
  chainId: number,
): Promise<ConfidentialPreflightSummary> {
  const { client, address, keys } = await requireLocalKeysAndAccountReady(
    signer,
    chainId,
  );
  void usdcDisplayToX100(displayAmount);
  const balance = await withTimeout(
    client.getConfidentialBalance(address, keys.privateKey, tokenAddress),
    60000,
    "Balance refresh",
  );
  return {
    address,
    availableCusdc: x100ToUsdcNumber(asBigIntAmount(balance.available.amount)),
    pendingCusdc: x100ToUsdcNumber(asBigIntAmount(balance.pending.amount)),
  };
}

export async function preflightConfidentialWithdraw(
  signer: ethers.Signer,
  tokenAddress: string,
  displayAmount: string,
  chainId: number,
): Promise<ConfidentialPreflightSummary> {
  const { client, address, keys } = await requireLocalKeysAndAccountReady(
    signer,
    chainId,
  );
  const amountX100 = usdcDisplayToX100(displayAmount);
  const balance = await withTimeout(
    client.getConfidentialBalance(address, keys.privateKey, tokenAddress),
    60000,
    "Balance refresh",
  );
  if (amountX100 > asBigIntAmount(balance.available.amount)) {
    throw new Error(
      "Withdraw amount is greater than available confidential balance.",
    );
  }
  return {
    address,
    availableCusdc: x100ToUsdcNumber(asBigIntAmount(balance.available.amount)),
    pendingCusdc: x100ToUsdcNumber(asBigIntAmount(balance.pending.amount)),
  };
}

export async function performConfidentialPayment(
  signer: ethers.Signer,
  recipient: string,
  tokenAddress: string,
  amountRaw: bigint,
  chainId: number,
  onStatus?: StatusHandler,
): Promise<string | undefined> {
  if (!ethers.isAddress(recipient))
    throw new Error("Recipient address is invalid.");

  const client = getClient(chainId);
  const senderKeys = await ensureConfidentialAccount(signer, chainId, onStatus);
  void senderKeys;

  // Receiver must initialize account at least once.
  onStatus?.("checking_recipient");
  const recipientInfo = await withTimeout(
    client.getAccountInfo(recipient),
    30000,
    "Recipient account check",
  );
  if (!recipientInfo?.exists) {
    throw new Error(
      "Recipient has no confidential account yet. Ask them to initialize Confidential Wallet first.",
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
        client.getConfidentialBalance(
          senderAddress,
          senderKeys.privateKey,
          tokenAddress,
        ),
        60000,
        "Balance refresh",
      ),
  });

  // Use available cUSDC first; only deposit missing amount from public USDC if needed.
  const availableX100 = asBigIntAmount(senderBalance.available.amount);
  const shortfallX100 =
    amountX100 > availableX100 ? amountX100 - availableX100 : BigInt(0);
  if (shortfallX100 > BigInt(0)) {
    throw new Error(
      `Insufficient confidential balance for payment. Need ${x100ToUsdcDisplay(
        shortfallX100,
      )} more. Open Confidential Wallet and convert more of the selected token first.`,
    );
  }
  onStatus?.("transferring");
  const transferResult = await withRetry({
    label: "Confidential transfer",
    onStatus,
    retries: 0,
    action: () =>
      withTimeout(
        client.confidentialTransfer(
          signer,
          recipient,
          tokenAddress,
          toSdkAmount(amountX100),
          {
            waitForFinalization: true,
          },
        ),
        180000,
        "Confidential transfer",
      ),
  });
  return extractTxHash(transferResult);
}

export async function depositUsdcToConfidential(
  signer: ethers.Signer,
  tokenAddress: string,
  displayAmount: string,
  chainId: number,
  onStatus?: StatusHandler,
): Promise<string | undefined> {
  await ensureConfidentialAccount(signer, chainId, onStatus);
  const { client } = await requireLocalKeysAndAccountReady(signer, chainId);
  const amountX100 = usdcDisplayToX100(displayAmount);
  await ensureStableTrustAllowance(
    signer,
    tokenAddress,
    chainId,
    amountX100,
    onStatus,
  );

  onStatus?.("depositing");
  const depositResult = await withRetry({
    label: "Confidential top up",
    onStatus,
    retries: 0,
    action: () =>
      withTimeout(
        client.confidentialDeposit(
          signer,
          tokenAddress,
          toSdkAmount(amountX100),
          {
            waitForFinalization: true,
          },
        ),
        180000,
        "Confidential top up",
      ),
  });
  return extractTxHash(depositResult);
}

export async function claimPendingConfidentialBalance(
  signer: ethers.Signer,
  tokenAddress: string,
  chainId: number,
  onStatus?: StatusHandler,
): Promise<string | undefined> {
  const client = getClient(chainId);
  const address = (await signer.getAddress()).toLowerCase();
  const keys = getStoredKeys(chainId, address);
  if (!keys) {
    throw new Error("Initialize confidential account first.");
  }
  const balance = await withTimeout(
    client.getConfidentialBalance(address, keys.privateKey, tokenAddress),
    60000,
    "Balance refresh",
  );
  const pending = asBigIntAmount(balance.pending.amount);
  if (pending <= BigInt(0)) {
    throw new Error("No pending confidential balance to claim.");
  }

  // Trigger state progression with a minimal top-up (0.01 USDC).
  const microAmount = BigInt(10000);
  await ensureStableTrustAllowance(
    signer,
    tokenAddress,
    chainId,
    microAmount,
    onStatus,
  );
  onStatus?.("depositing");
  const claimResult = await withRetry({
    label: "Pending claim trigger",
    onStatus,
    retries: 0,
    action: () =>
      withTimeout(
        client.confidentialDeposit(
          signer,
          tokenAddress,
          toSdkAmount(microAmount),
          {
            waitForFinalization: true,
          },
        ),
        180000,
        "Pending claim trigger",
      ),
  });
  return extractTxHash(claimResult);
}

export async function getConfidentialBalanceSummary(
  signer: ethers.Signer,
  tokenAddress: string,
  chainId: number,
  onStatus?: StatusHandler,
): Promise<{ total: number; available: number; pending: number }> {
  const client = getClient(chainId);
  const address = (await signer.getAddress()).toLowerCase();
  let keys = getStoredKeys(chainId, address);
  if (!keys) {
    throw new Error("Initialize confidential account first.");
  }
  onStatus?.("reading_balance");
  let balance: Awaited<
    ReturnType<ConfidentialTransferClient["getConfidentialBalance"]>
  >;
  try {
    balance = await withTimeout(
      client.getConfidentialBalance(address, keys.privateKey, tokenAddress),
      60000,
      "Balance refresh",
    );
  } catch (error) {
    if (!isLikelyDecryptionFailure(error)) throw error;
    try {
      const recovered = await refreshStoredKeysFromSigner(signer, chainId);
      keys = recovered.keys;
      balance = await withTimeout(
        client.getConfidentialBalance(address, keys.privateKey, tokenAddress),
        60000,
        "Balance refresh",
      );
    } catch (recoveryError) {
      const hasLegacyBalance = await readLegacyBalanceIfPresent(
        signer,
        tokenAddress,
        chainId,
      );
      if (hasLegacyBalance) {
        throw new Error(
          "Detected confidential funds on a previous StableTrust deployment. Your current app is using the updated deployment, so old balances cannot be decrypted here. Use the previous deployment to withdraw/migrate funds, then initialize this deployment again.",
        );
      }
      if (!isLikelyDecryptionFailure(recoveryError)) throw recoveryError;
      throw new Error(
        "Confidential key mismatch detected. Re-initialize Confidential Wallet and confirm the signature prompt from the same wallet/account, then retry refresh.",
      );
    }
  }
  return {
    total: x100ToUsdcNumber(asBigIntAmount(balance.amount)),
    available: x100ToUsdcNumber(asBigIntAmount(balance.available.amount)),
    pending: x100ToUsdcNumber(asBigIntAmount(balance.pending.amount)),
  };
}

export async function withdrawConfidentialToUsdc(
  signer: ethers.Signer,
  tokenAddress: string,
  displayAmount: string,
  chainId: number,
  onStatus?: StatusHandler,
): Promise<string | undefined> {
  const { client, address, keys } = await requireLocalKeysAndAccountReady(
    signer,
    chainId
  );
  const amountX100 = usdcDisplayToX100(displayAmount);
  const balance = await withTimeout(
    client.getConfidentialBalance(address, keys.privateKey, tokenAddress),
    60000,
    "Balance refresh"
  );
  if (amountX100 > asBigIntAmount(balance.available.amount)) {
    throw new Error(
      "Withdraw amount is greater than available confidential balance."
    );
  }
  onStatus?.("withdrawing");
  const withdrawResult = await withRetry({
    label: "Confidential withdraw",
    onStatus,
    retries: 0,
    action: () =>
      withTimeout(
        client.withdraw(signer, tokenAddress, toSdkAmount(amountX100), {
          waitForFinalization: true,
        }),
        180000,
        "Confidential withdraw",
      ),
  });
  return extractTxHash(withdrawResult);
}

/** Current StableTrust proxy for the given chain (from SDK + app-specific overrides). */
export function getResolvedStableTrustContract(chainId: number): string | null {
  return resolveStableTrustContractAddress(chainId);
}
