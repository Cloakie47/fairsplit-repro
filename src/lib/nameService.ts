"use client";

import {
  createPublicClient,
  getAddress as toChecksumAddress,
  http,
  isAddress,
  type Address,
} from "viem";
import { base, baseSepolia, mainnet } from "viem/chains";
import {
  getAddress as onchainkitGetAddress,
  getName as onchainkitGetName,
} from "@coinbase/onchainkit/identity";

const mainnetRpc = process.env.NEXT_PUBLIC_MAINNET_RPC_URL;

const client = createPublicClient({
  chain: mainnet,
  transport: http(mainnetRpc),
});

const inputToAddressCache = new Map<string, Address>();
const addressToNameCache = new Map<string, string>();
const RESOLVED_NAME_STORAGE_KEY = "fairysplit_resolved_names_v1";
const RESOLVED_NAME_EVENT = "fairysplit-resolved-name-updated";
const ARC_TESTNET_CHAIN_ID = 5042002;

type ResolvedNameMap = Record<string, string>;

function resolvedNameStorageKey(address: Address, chainId?: number): string {
  return `${address.toLowerCase()}:${chainId ?? 0}`;
}

function readResolvedNames(): ResolvedNameMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(RESOLVED_NAME_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ResolvedNameMap) : {};
  } catch {
    return {};
  }
}

function writeResolvedNames(next: ResolvedNameMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RESOLVED_NAME_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(RESOLVED_NAME_EVENT));
  } catch {
    // Ignore localStorage failures; in-memory and live resolution still work.
  }
}

function setLocallyResolvedName(address: Address, name: string, chainId?: number): void {
  const next = readResolvedNames();
  next[resolvedNameStorageKey(address, chainId)] = normalizeInput(name);
  writeResolvedNames(next);
}

function getLocallyResolvedName(address: Address, chainId?: number): string | null {
  const all = readResolvedNames();
  return all[resolvedNameStorageKey(address, chainId)] ?? null;
}

function normalizeInput(input: string): string {
  return input.trim().toLowerCase();
}

function isBasename(name: string): boolean {
  const normalized = normalizeInput(name);
  return normalized.endsWith(".base.eth") || normalized.endsWith(".basetest.eth");
}

function isNameLike(input: string): boolean {
  const normalized = normalizeInput(input);
  return (
    normalized.endsWith(".eth") ||
    normalized.endsWith(".base") ||
    normalized.endsWith(".base.eth") ||
    normalized.endsWith(".basetest.eth")
  );
}

function getResolutionChain(chainId?: number) {
  if (chainId === base.id) return base;
  if (chainId === baseSepolia.id) return baseSepolia;
  return undefined;
}

function normalizeResolvableNames(input: string, chainId?: number): string[] {
  const normalized = normalizeInput(input);
  if (chainId === baseSepolia.id && normalized.endsWith(".base.eth")) {
    return [normalized.replace(/\.base\.eth$/, ".basetest.eth"), normalized];
  }
  if (chainId === baseSepolia.id && normalized.endsWith(".basetest.eth")) {
    return [normalized, normalized.replace(/\.basetest\.eth$/, ".base.eth")];
  }
  if (normalized.endsWith(".base")) {
    const basename = normalized.slice(0, -".base".length);
    if (chainId === baseSepolia.id) {
      return [`${basename}.basetest.eth`, `${basename}.base.eth`];
    }
    return [`${basename}.base.eth`];
  }
  return [normalized];
}

function getCoinTypeFromName(name: string): bigint | null {
  if (name.endsWith(".base.eth")) return BigInt(2 ** 31 + base.id);
  if (name.endsWith(".basetest.eth")) return BigInt(2 ** 31 + baseSepolia.id);
  return null;
}

export function parseParticipantInputs(input: string): string[] {
  return input
    .split(/[\s,]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export async function resolveInputToAddress(input: string, chainId?: number): Promise<Address> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Participant cannot be empty.");
  }

  if (isAddress(trimmed)) {
    return toChecksumAddress(trimmed);
  }

  const candidateNames = normalizeResolvableNames(trimmed, chainId);
  if (!candidateNames.some((name) => isNameLike(name))) {
    throw new Error(`"${input}" is not a valid address, .eth, or .base name.`);
  }

  const cacheKey = `${candidateNames.join("|")}:${chainId ?? 0}`;
  const cached = inputToAddressCache.get(cacheKey);
  if (cached) return cached;

  let resolved: Address | null = null;

  const attempts: Array<() => Promise<Address | null>> = [];
  const resolutionChain = getResolutionChain(chainId);
  for (const name of candidateNames) {
    if (resolutionChain) {
      attempts.push(() => onchainkitGetAddress({ name, chain: resolutionChain }));
    }
    attempts.push(() => onchainkitGetAddress({ name }));

    const coinType = getCoinTypeFromName(name);
    if (coinType) {
      attempts.push(() =>
        client.getEnsAddress({
          name,
          coinType,
          strict: false,
        })
      );
    }
    attempts.push(() => client.getEnsAddress({ name, strict: false }));
  }

  for (const run of attempts) {
    try {
      resolved = await run();
      if (resolved) break;
    } catch {
      // Some resolver paths can revert for unsupported names/providers.
      // Continue through fallback attempts and return a friendly error if all fail.
    }
  }

  if (!resolved) {
    throw new Error(
      `Could not resolve "${input}". Use a wallet address, or verify the .base/.eth name has a valid resolution record.`
    );
  }

  const checksummed = toChecksumAddress(resolved);
  inputToAddressCache.set(cacheKey, checksummed);
  setLocallyResolvedName(checksummed, candidateNames[0] ?? normalizeInput(input), chainId);
  return checksummed;
}

export async function resolveAddressToPreferredName(
  address: Address,
  chainId?: number
): Promise<string | null> {
  const cacheKey = resolvedNameStorageKey(address, chainId);
  if (addressToNameCache.has(cacheKey)) {
    return addressToNameCache.get(cacheKey) ?? null;
  }

  const locallyResolved = getLocallyResolvedName(address, chainId);
  if (locallyResolved) {
    addressToNameCache.set(cacheKey, locallyResolved);
    return locallyResolved;
  }

  let resolvedName: string | null = null;
  const resolutionChain = getResolutionChain(chainId);

  // ENS-style lookup for all chains; use chain context first when available.
  if (resolutionChain) {
    try {
      resolvedName = (await onchainkitGetName({ address, chain: resolutionChain })) ?? null;
    } catch {
      resolvedName = null;
    }
  }
  if (!resolvedName) {
    try {
      resolvedName = (await onchainkitGetName({ address, chain: base })) ?? null;
    } catch {
      resolvedName = null;
    }
  }
  if (!resolvedName) {
    try {
      resolvedName = (await onchainkitGetName({ address })) ?? null;
    } catch {
      resolvedName = null;
    }
  }
  if (!resolvedName) {
    try {
      resolvedName = await client.getEnsName({ address, strict: false });
    } catch {
      resolvedName = null;
    }
  }

  // ARC rule: never display Base names on ARC.
  // If ARC has no ENS-style name, caller should fall back to profile/address.
  if (chainId === ARC_TESTNET_CHAIN_ID && resolvedName && isBasename(resolvedName)) {
    resolvedName = null;
  }

  if (resolvedName) {
    setLocallyResolvedName(address, resolvedName, chainId);
    addressToNameCache.set(cacheKey, resolvedName);
  }
  return resolvedName ?? null;
}

