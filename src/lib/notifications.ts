"use client";

export type NotificationType =
  | "split_created"
  | "split_paid_normal"
  | "split_paid_confidential"
  | "reminder";

export type NotificationItem = {
  id: string;
  userAddress: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  relatedChainId?: number;
  relatedBillId?: string;
  createdAt: number;
};

const STORAGE_KEY = "fairysplit_notifications";
const NOTIFICATIONS_UPDATED_EVENT = "fairysplit_notifications_updated";

function normalize(address: string): string {
  return address.toLowerCase();
}

function notifyListeners(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
}

function getAll(): NotificationItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NotificationItem[]) : [];
  } catch {
    return [];
  }
}

function setAll(items: NotificationItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  notifyListeners();
}

export function subscribeNotifications(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, listener);
  return () => window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, listener);
}

export function getNotificationsForUser(userAddress: string): NotificationItem[] {
  const user = normalize(userAddress);
  return getAll()
    .filter((n) => n.userAddress === user)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function addNotification(
  userAddress: string,
  input: Omit<NotificationItem, "id" | "userAddress" | "isRead" | "createdAt">
): NotificationItem {
  const next: NotificationItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userAddress: normalize(userAddress),
    isRead: false,
    createdAt: Date.now(),
    ...input,
  };
  setAll([next, ...getAll()]);
  void import("@/lib/cloud-sync").then((m) => {
    if (m.isCloudSyncConfigured()) m.schedulePushNotifications(userAddress);
  });
  return next;
}

export function markAllNotificationsRead(userAddress: string): void {
  const user = normalize(userAddress);
  const updated = getAll().map((n) =>
    n.userAddress === user ? { ...n, isRead: true } : n
  );
  setAll(updated);
  void import("@/lib/cloud-sync").then((m) => {
    if (m.isCloudSyncConfigured()) m.schedulePushNotifications(userAddress);
  });
}

export function getUnreadCount(userAddress: string): number {
  return getNotificationsForUser(userAddress).filter((n) => !n.isRead).length;
}

/** Upsert by id (e.g. after server sync). */
export function mergeNotificationItems(incoming: NotificationItem[]): void {
  if (incoming.length === 0) return;
  const map = new Map<string, NotificationItem>();
  for (const n of getAll()) {
    map.set(n.id, n);
  }
  for (const n of incoming) {
    map.set(n.id, n);
  }
  setAll(
    Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt)
  );
}

