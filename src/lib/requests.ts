"use client";

import { addNotification, mergeNotificationItems } from "@/lib/notifications";
import { getProfile } from "@/lib/profile";

export type SplitRequestStatus =
  | "pending"
  | "paid_normal"
  | "paid_confidential";

export type SplitRequest = {
  id: string;
  chainId: number;
  billId: string;
  splitName: string;
  creatorAddress: string;
  participantAddress: string;
  amountUsdc?: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  isConfidential: boolean;
  status: SplitRequestStatus;
  createdAt: number;
  paidAt?: number;
};

export type MarkSplitRequestPaidParams = {
  chainId: number;
  billId: string;
  participantAddress: string;
  mode: "normal" | "confidential";
  splitName: string;
  creatorAddress: string;
};

const STORAGE_KEY = "fairysplit_split_requests";

function normalize(address: string): string {
  return address.toLowerCase();
}

function getAll(): SplitRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SplitRequest[]) : [];
  } catch {
    return [];
  }
}

function setAll(items: SplitRequest[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function getIncomingRequests(userAddress: string): SplitRequest[] {
  const user = normalize(userAddress);
  return getAll()
    .filter((r) => r.participantAddress === user)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getOutgoingRequests(userAddress: string): SplitRequest[] {
  const user = normalize(userAddress);
  return getAll()
    .filter((r) => r.creatorAddress === user)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function buildNextRequests(
  params: {
    chainId: number;
    billId: string;
    splitName: string;
    creatorAddress: string;
    participants: string[];
    amountUsdc: string;
    tokenAddress?: string;
    tokenSymbol?: string;
  },
  creator: string,
  now: number
): SplitRequest[] {
  return params.participants
    .map((addr) => normalize(addr))
    .filter((addr) => addr !== creator)
    .map((participant) => {
      const uniqueId = `${params.chainId}-${params.billId}-${participant}`;
      return {
        id: uniqueId,
        chainId: params.chainId,
        billId: params.billId,
        splitName: params.splitName,
        creatorAddress: creator,
        participantAddress: participant,
        amountUsdc: params.amountUsdc,
        tokenAddress: params.tokenAddress,
        tokenSymbol: params.tokenSymbol,
        isConfidential: false,
        status: "pending" as const,
        createdAt: now,
      };
    });
}

function mergeRequestsIntoStorage(next: SplitRequest[]): void {
  const existing = getAll();
  const deduped = existing.filter(
    (item) =>
      !next.some(
        (incoming) =>
          incoming.chainId === item.chainId &&
          incoming.billId === item.billId &&
          incoming.participantAddress === item.participantAddress
      )
  );
  setAll([...next, ...deduped]);
}

function addLocalSplitNotifications(params: {
  chainId: number;
  billId: string;
  splitName: string;
  customReminder?: string;
  next: SplitRequest[];
}): void {
  for (const req of params.next) {
    addNotification(req.participantAddress, {
      type: "split_created",
      title: "New split request",
      body: params.customReminder?.trim()
        ? `${params.splitName}: ${params.customReminder.trim()}`
        : `You were added to "${params.splitName}".`,
      relatedChainId: params.chainId,
      relatedBillId: params.billId,
    });

    const profile = getProfile(req.participantAddress);
    if (profile?.email && profile.emailRemindersOptIn) {
      addNotification(req.creatorAddress, {
        type: "reminder",
        title: "Email alert queued",
        body: `Email reminder would be sent to ${profile.email} after backend SMTP is configured.`,
        relatedChainId: params.chainId,
        relatedBillId: params.billId,
      });
    }
  }
}

export async function createSplitRequests(params: {
  chainId: number;
  billId: string;
  splitName: string;
  creatorAddress: string;
  participants: string[];
  amountUsdc: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  customReminder?: string;
}): Promise<void> {
  const creator = normalize(params.creatorAddress);
  const now = Date.now();

  let next: SplitRequest[] = buildNextRequests(params, creator, now);
  let serverNotifications: import("@/lib/notifications").NotificationItem[] | null =
    null;

  const { isCloudSyncConfigured, remoteCreateSplitRequests } = await import(
    "@/lib/cloud-sync"
  );

  if (isCloudSyncConfigured()) {
    try {
      const out = await remoteCreateSplitRequests(params);
      next = out.requests;
      serverNotifications = out.notifications;
    } catch (e) {
      console.warn(
        "[requests] Supabase create split failed, using local only",
        e
      );
      next = buildNextRequests(params, creator, now);
    }
  }

  mergeRequestsIntoStorage(next);

  if (serverNotifications?.length) {
    mergeNotificationItems(serverNotifications);
  } else {
    addLocalSplitNotifications({
      chainId: params.chainId,
      billId: params.billId,
      splitName: params.splitName,
      customReminder: params.customReminder,
      next,
    });
  }

  void import("@/lib/cloud-sync").then((m) => {
    if (!m.isCloudSyncConfigured()) return;
    m.schedulePushSplitRequests(params.creatorAddress);
    for (const p of params.participants) {
      m.schedulePushSplitRequests(normalize(p));
    }
  });
}

function applyMarkPaidLocalOnly(params: MarkSplitRequestPaidParams): void {
  const participant = normalize(params.participantAddress);
  const now = Date.now();
  const nextStatus: SplitRequestStatus =
    params.mode === "normal" ? "paid_normal" : "paid_confidential";

  const updated = getAll().map((item) => {
    const same =
      item.chainId === params.chainId &&
      item.billId === params.billId &&
      item.participantAddress === participant;
    if (!same) return item;
    return {
      ...item,
      status: nextStatus,
      isConfidential: params.mode === "confidential",
      paidAt: now,
    };
  });
  setAll(updated);
}

function applyMarkPaidWithCreatorNotification(
  params: MarkSplitRequestPaidParams
): void {
  applyMarkPaidLocalOnly(params);
  const participant = normalize(params.participantAddress);
  const creator = normalize(params.creatorAddress);
  addNotification(creator, {
    type:
      params.mode === "normal"
        ? "split_paid_normal"
        : "split_paid_confidential",
    title:
      params.mode === "normal"
        ? "Split paid (normal)"
        : "Split paid (confidential)",
    body:
      params.mode === "normal"
        ? `${participant.slice(0, 6)}...${participant.slice(-4)} paid "${params.splitName}".`
        : `A confidential payment was completed for "${params.splitName}".`,
    relatedChainId: params.chainId,
    relatedBillId: params.billId,
  });
}

export async function markSplitRequestPaid(
  params: MarkSplitRequestPaidParams
): Promise<void> {
  const { isCloudSyncConfigured, remoteMarkSplitRequestPaid } = await import(
    "@/lib/cloud-sync"
  );

  if (isCloudSyncConfigured()) {
    try {
      const out = await remoteMarkSplitRequestPaid(params);
      if (out.request) {
        const byId = new Map(getAll().map((r) => [r.id, r]));
        byId.set(out.request.id, out.request);
        setAll(Array.from(byId.values()));
      } else {
        applyMarkPaidLocalOnly(params);
      }
      if (out.notification) {
        mergeNotificationItems([out.notification]);
      }
      void import("@/lib/cloud-sync").then((m) => {
        if (!m.isCloudSyncConfigured()) return;
        m.schedulePushSplitRequests(params.participantAddress);
        m.schedulePushSplitRequests(params.creatorAddress);
      });
      return;
    } catch (e) {
      console.warn(
        "[requests] Supabase mark-paid failed, applying local only",
        e
      );
    }
  }

  applyMarkPaidWithCreatorNotification(params);
  void import("@/lib/cloud-sync").then((m) => {
    if (!m.isCloudSyncConfigured()) return;
    m.schedulePushSplitRequests(params.participantAddress);
    m.schedulePushSplitRequests(params.creatorAddress);
  });
}
