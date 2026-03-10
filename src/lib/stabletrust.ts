import { ethers } from "ethers";
import { ConfidentialTransferClient } from "@/app/stabletrust/src";
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
  84532: "0x962a8A7CD28BfFBb17C4F6Ec388782cca3ffd618", // Base testnet (current)
  1244: "0xb20aB54e1c6AE55B0DD11FEB7FFf3fF1E9631f19", // Arc canonical chain id (current deployment)
  // Arc app-chain id maps to the same canonical StableTrust deployment.
  5042002: "0xb20aB54e1c6AE55B0DD11FEB7FFf3fF1E9631f19",
};

const STABLETRUST_LEGACY_ADDRESSES: Record<number, string[]> = {
  84532: ["0x6FE45A71F5232a4E5e583Ae31A538360fB1e6aDb"],
  1244: ["0xf085e801a6FD9d03b09566a738734B7e2Bb065De"],
  5042002: ["0xf085e801a6FD9d03b09566a738734B7e2Bb065De"],
};

const STABLETRUST_RPCS: Record<number, string> = {
  84532: "https://sepolia.base.org",
  1244: "https://rpc.testnet.arc.network",
  5042002: "https://rpc.testnet.arc.network",
};

const STABLETRUST_CHAIN_IDS: Record<number, number> = {
  84532: 84532,
  1244: 1244,
  // Must match the connected wallet chain for eth_signTypedData_v4.
  5042002: 5042002,
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
  const contract = contractAddress ?? STABLETRUST_ADDRESSES[chainId];
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
  const active = STABLETRUST_ADDRESSES[chainId]?.toLowerCase();
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
  const rpc = STABLETRUST_RPCS[chainId];
  const contractAddress =
    contractAddressOverride ?? STABLETRUST_ADDRESSES[chainId];
  const sdkChainId = STABLETRUST_CHAIN_IDS[chainId];
  if (!rpc || !contractAddress || !sdkChainId) {
    throw new Error("Confidential transfer is not configured for this chain.");
  }
  return new ConfidentialTransferClient(rpc, contractAddress, sdkChainId);
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
      "USDC approval is missing or too low for confidential deposit. Approve USDC and retry.",
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
    lastError instanceof Error
      ? lastError
      : new Error(`${params.label} failed.`),
  );
}

async function waitForAccountReady(
  client: ConfidentialTransferClient,
  address: string,
  onStatus?: StatusHandler,
): Promise<boolean> {
  onStatus?.("finalizing");
  const attempts = 30;
  for (let i = 0; i < attempts; i++) {
    try {
      const info = await withTimeout(
        client.getAccountInfo(address),
        30000,
        "Account readiness",
      );
      if (info?.exists) return true;
    } catch {
      // Best-effort readiness polling only.
    }
    await sleep(2000);
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
          maxAttempts: 30,
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
          maxAttempts: 30,
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
  // Persist keys immediately and treat readiness as best-effort.
  await waitForAccountReady(client, address, onStatus);
  return derived;
}

async function requireLocalKeysAndAccountReady(
  signer: ethers.Signer,
  chainId: number,
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
      `Insufficient cUSDC for confidential payment. Need ${x100ToUsdcDisplay(
        shortfallX100,
      )} more cUSDC. Open Confidential Wallet and convert USDC to cUSDC first.`,
    );
  }
  return {
    address,
    availableCusdc: x100ToUsdcNumber(asBigIntAmount(balance.available.amount)),
    pendingCusdc: x100ToUsdcNumber(asBigIntAmount(balance.pending.amount)),
  };
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
      `Insufficient cUSDC for confidential payment. Need ${x100ToUsdcDisplay(
        shortfallX100,
      )} more cUSDC. Open Confidential Wallet and convert USDC to cUSDC first.`,
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
  const client = getClient(chainId);
  await ensureConfidentialAccount(signer, chainId, onStatus);
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
    throw new Error("No pending cUSDC to claim.");
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
  const client = getClient(chainId);
  const address = (await signer.getAddress()).toLowerCase();
  if (!getStoredKeys(chainId, address)) {
    throw new Error("Initialize confidential account first.");
  }
  const amountX100 = usdcDisplayToX100(displayAmount);
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

export { STABLETRUST_ADDRESSES };
