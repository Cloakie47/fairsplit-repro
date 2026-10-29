/**
 * FairEats configuration.
 *
 * FairEats is Base-only. Everything chain-related funnels through
 * FAIREATS_CHAIN_ID so moving to Base mainnet is a one-line change here plus
 * adding 8453 to `src/lib/wagmi.ts`. Arc and Tempo remain supported elsewhere
 * in the app and are simply out of scope for FairEats routes.
 */

import { CONTRACTS } from "@/config/contracts";

/** Base Sepolia. Build and test target for FairEats. */
export const FAIREATS_CHAIN_ID = CONTRACTS.baseSepolia.chainId;

export const FAIREATS_CHAIN_NAME = "Base Sepolia";

export const FAIREATS_USDC_ADDRESS = CONTRACTS.baseSepolia.usdc;

export const FAIREATS_FAIRSPLIT_ADDRESS = CONTRACTS.baseSepolia.fairsplitV2;

export function isFairEatsChain(chainId?: number): boolean {
  return chainId === FAIREATS_CHAIN_ID;
}

/**
 * A stale table lock is swept after this long. Owner-only release would leave
 * a forgotten table occupied forever, so the occupant can release their own
 * table, the merchant can release any of theirs, and anything older than this
 * is treated as abandoned.
 */
export const TABLE_LOCK_TIMEOUT_MS = 3 * 60 * 60 * 1000;

/**
 * FairsplitV2.MAX_PARTICIPANTS is 20 and `createSplit` reverts above it.
 * The UI caps the picker here so the limit surfaces as a message rather than a
 * reverted transaction at a restaurant table.
 */
export const MAX_SPLIT_PARTICIPANTS = 20;

/**
 * USDC has 6 decimals, so one micro-USDC is exactly one raw contract unit.
 * Money is carried as bigint micro-USDC end to end — database, pricing and
 * contract calls — and never as a float.
 */
export const USDC_DECIMALS = 6;
export const ONE_USDC_MICRO = BigInt(1_000_000);
