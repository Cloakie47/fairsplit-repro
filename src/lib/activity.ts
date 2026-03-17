"use client";

export type ActivityType =
  | "bill_created"
  | "bill_paid_normal"
  | "bill_paid_confidential"
  | "direct_paid_normal"
  | "direct_paid_confidential"
  | "usdc_bridged"
  | "confidential_account_initialized"
  | "confidential_balance_refreshed"
  | "confidential_topup_completed"
  | "confidential_withdraw_completed"
  | "confidential_claim_completed";

export type ActivityItem = {
  id: string;
  type: ActivityType;
  title: string;
  details?: string;
  chainId?: number;
  txHash?: string;
  billId?: string;
  timestamp: number;
};

const STORAGE_KEY_PREFIX = "fairysplit_activity_";

function getStorageKey(address: string): string {
  return `${STORAGE_KEY_PREFIX}${address.toLowerCase()}`;
}

type ActivityMeta = {
  chainId?: number;
  txHash?: string;
  billId?: string;
};

export function getActivity(address: string): ActivityItem[] {
  if (typeof window === "undefined" || !address) return [];
  try {
    const raw = window.localStorage.getItem(getStorageKey(address));
    const parsed = raw ? (JSON.parse(raw) as ActivityItem[]) : [];
    return parsed.sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

export function logActivity(
  address: string,
  type: ActivityType,
  title: string,
  details?: string,
  meta?: ActivityMeta
): void {
  if (typeof window === "undefined" || !address) return;
  const next: ActivityItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    details,
    chainId: meta?.chainId,
    txHash: meta?.txHash,
    billId: meta?.billId,
    timestamp: Date.now(),
  };
  const existing = getActivity(address);
  window.localStorage.setItem(getStorageKey(address), JSON.stringify([next, ...existing]));
}

