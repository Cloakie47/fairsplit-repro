"use client";

export type ActivityType =
  | "bill_created"
  | "bill_paid_normal"
  | "bill_paid_confidential"
  | "direct_paid_normal"
  | "direct_paid_confidential"
  | "confidential_account_initialized"
  | "confidential_balance_refreshed"
  | "confidential_withdraw_completed";

export type ActivityItem = {
  id: string;
  type: ActivityType;
  title: string;
  details?: string;
  timestamp: number;
};

const STORAGE_KEY = "fairysplit_activity";

export function getActivity(): ActivityItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ActivityItem[]) : [];
    return parsed.sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

export function logActivity(
  type: ActivityType,
  title: string,
  details?: string
): void {
  if (typeof window === "undefined") return;
  const next: ActivityItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    details,
    timestamp: Date.now(),
  };
  const existing = getActivity();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([next, ...existing]));
}

