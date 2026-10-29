"use client";

import { buildWalletAuthMessage } from "@/lib/wallet-auth-message";

const CLOUD_SYNC_EVENT = "fairysplit-cloud-synced";

export function dispatchCloudSynced(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CLOUD_SYNC_EVENT));
}

export function subscribeCloudSynced(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CLOUD_SYNC_EVENT, listener);
  return () => window.removeEventListener(CLOUD_SYNC_EVENT, listener);
}

type SignFn = (message: string) => Promise<`0x${string}` | string>;

let signMessageRef: SignFn | null = null;
const sessionReadyByWallet = new Set<string>();
const sessionInFlightByWallet = new Map<string, Promise<void>>();

export function registerCloudSyncSigner(fn: SignFn | null): void {
  signMessageRef = fn;
}

export function isCloudSyncConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export async function getWalletAuthPayload(walletAddress: string): Promise<{
  walletAddress: string;
  message: string;
  signature: string;
}> {
  const sign = signMessageRef;
  if (!sign) {
    throw new Error("Wallet signer not ready — try again in a moment.");
  }
  const message = buildWalletAuthMessage(walletAddress);
  const signature = await sign(message);
  return { walletAddress, message, signature };
}

async function ensureWalletSessionOnConnect(walletAddress: string): Promise<void> {
  const walletLower = walletAddress.toLowerCase();
  if (sessionReadyByWallet.has(walletLower)) return;

  const inFlight = sessionInFlightByWallet.get(walletLower);
  if (inFlight) {
    await inFlight;
    return;
  }

  const pending = (async () => {
    const auth = await getWalletAuthPayload(walletLower);
    const res = await fetch("/api/auth/wallet-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(auth),
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    sessionReadyByWallet.add(walletLower);
  })();

  sessionInFlightByWallet.set(walletLower, pending);
  try {
    await pending;
  } finally {
    sessionInFlightByWallet.delete(walletLower);
  }
}

type PullPayload = {
  profile: import("@/lib/profile").Profile | null;
  friends: import("@/lib/friends").Friend[];
  activity: import("@/lib/activity").ActivityItem[];
  splitRequests: import("@/lib/requests").SplitRequest[];
  notifications: import("@/lib/notifications").NotificationItem[];
};

export async function pullFromCloud(walletAddress: string): Promise<boolean> {
  if (!isCloudSyncConfigured()) return false;

  try {
    const walletLower = walletAddress.toLowerCase();
    await ensureWalletSessionOnConnect(walletLower);
    const res = await fetch("/api/data/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: walletLower }),
    });

    if (!res.ok) {
      console.warn("[cloud-sync] pull failed", await res.text());
      return false;
    }

    const payload = (await res.json()) as PullPayload;
    applyPullToLocalStorage(walletAddress, payload);
    dispatchCloudSynced();
    return true;
  } catch (e) {
    console.warn("[cloud-sync] pull error", e);
    return false;
  }
}

function applyPullToLocalStorage(
  walletLower: string,
  p: PullPayload
): void {
  const w = walletLower.toLowerCase();

  if (p.profile) {
    const raw = localStorage.getItem("fairysplit_profiles");
    const profiles = raw ? (JSON.parse(raw) as Record<string, import("@/lib/profile").Profile>) : {};
    profiles[w] = {
      walletAddress: w,
      displayName: p.profile.displayName,
      email: p.profile.email,
      emailRemindersOptIn: p.profile.emailRemindersOptIn,
    };
    localStorage.setItem("fairysplit_profiles", JSON.stringify(profiles));
    window.dispatchEvent(new Event("fairysplit-profile-updated"));
  }

  const friendsRaw = localStorage.getItem("fairysplit_friends");
  const allFriends = friendsRaw ? (JSON.parse(friendsRaw) as import("@/lib/friends").Friend[]) : [];
  const others = allFriends.filter((f) => f.ownerAddress.toLowerCase() !== w);
  localStorage.setItem(
    "fairysplit_friends",
    JSON.stringify([...p.friends, ...others])
  );

  const activityKey = `fairysplit_activity_${w}`;
  const existingActivityRaw = localStorage.getItem(activityKey);
  const existingActivity = existingActivityRaw
    ? (JSON.parse(existingActivityRaw) as import("@/lib/activity").ActivityItem[])
    : [];
  const activityById = new Map(existingActivity.map((item) => [item.id, item]));
  for (const item of p.activity) {
    activityById.set(item.id, item);
  }
  const mergedActivity = Array.from(activityById.values()).sort(
    (a, b) => b.timestamp - a.timestamp
  );
  localStorage.setItem(activityKey, JSON.stringify(mergedActivity));

  const reqRaw = localStorage.getItem("fairysplit_split_requests");
  const existingReq = reqRaw
    ? (JSON.parse(reqRaw) as import("@/lib/requests").SplitRequest[])
    : [];
  const byId = new Map(existingReq.map((r) => [r.id, r]));
  for (const r of p.splitRequests) {
    byId.set(r.id, r);
  }
  localStorage.setItem(
    "fairysplit_split_requests",
    JSON.stringify(Array.from(byId.values()))
  );

  const notifRaw = localStorage.getItem("fairysplit_notifications");
  const allNotif = notifRaw
    ? (JSON.parse(notifRaw) as import("@/lib/notifications").NotificationItem[])
    : [];
  const notifOthers = allNotif.filter(
    (n) => n.userAddress.toLowerCase() !== w
  );
  localStorage.setItem(
    "fairysplit_notifications",
    JSON.stringify([...p.notifications, ...notifOthers])
  );
  window.dispatchEvent(new Event("fairysplit_notifications_updated"));
}

const friendTimers = new Map<string, ReturnType<typeof setTimeout>>();
const activityTimers = new Map<string, ReturnType<typeof setTimeout>>();
const notifTimers = new Map<string, ReturnType<typeof setTimeout>>();
const splitTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function schedulePushFriends(ownerAddress: string): void {
  if (!isCloudSyncConfigured()) return;
  const k = ownerAddress.toLowerCase();
  const t = friendTimers.get(k);
  if (t) clearTimeout(t);
  friendTimers.set(
    k,
    setTimeout(() => {
      friendTimers.delete(k);
      void pushFriendsReplace(k);
    }, 1200)
  );
}

async function pushFriendsReplace(ownerLower: string): Promise<void> {
  try {
    const { getFriends } = await import("@/lib/friends");
    const friends = getFriends(ownerLower);
    const res = await fetch("/api/friends", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: ownerLower, friends }),
    });
    if (!res.ok) console.warn("[cloud-sync] friends push", await res.text());
  } catch (e) {
    console.warn("[cloud-sync] friends push", e);
  }
}

export function schedulePushActivity(walletAddress: string): void {
  if (!isCloudSyncConfigured()) return;
  const k = walletAddress.toLowerCase();
  const t = activityTimers.get(k);
  if (t) clearTimeout(t);
  activityTimers.set(
    k,
    setTimeout(() => {
      activityTimers.delete(k);
      void pushActivityReplace(k);
    }, 1500)
  );
}

async function pushActivityReplace(walletLower: string): Promise<void> {
  try {
    const { getActivity } = await import("@/lib/activity");
    const items = getActivity(walletLower);
    const res = await fetch("/api/activity", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: walletLower, items }),
    });
    if (!res.ok) console.warn("[cloud-sync] activity push", await res.text());
  } catch (e) {
    console.warn("[cloud-sync] activity push", e);
  }
}

export function schedulePushNotifications(userAddress: string): void {
  if (!isCloudSyncConfigured()) return;
  const k = userAddress.toLowerCase();
  const t = notifTimers.get(k);
  if (t) clearTimeout(t);
  notifTimers.set(
    k,
    setTimeout(() => {
      notifTimers.delete(k);
      void pushNotificationsReplace(k);
    }, 1200)
  );
}

async function pushNotificationsReplace(userLower: string): Promise<void> {
  try {
    const { getNotificationsForUser } = await import("@/lib/notifications");
    const notifications = getNotificationsForUser(userLower);
    const res = await fetch("/api/notifications/sync", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: userLower, notifications }),
    });
    if (!res.ok) console.warn("[cloud-sync] notifications push", await res.text());
  } catch (e) {
    console.warn("[cloud-sync] notifications push", e);
  }
}

export function schedulePushSplitRequests(walletAddress: string): void {
  if (!isCloudSyncConfigured()) return;
  const k = walletAddress.toLowerCase();
  const t = splitTimers.get(k);
  if (t) clearTimeout(t);
  splitTimers.set(
    k,
    setTimeout(() => {
      splitTimers.delete(k);
      void pushSplitRequestsSubset(k);
    }, 1200)
  );
}

async function pushSplitRequestsSubset(walletLower: string): Promise<void> {
  try {
    const raw = localStorage.getItem("fairysplit_split_requests");
    const all = raw
      ? (JSON.parse(raw) as import("@/lib/requests").SplitRequest[])
      : [];
    const w = walletLower;
    const requests = all.filter(
      (r) =>
        r.creatorAddress.toLowerCase() === w ||
        r.participantAddress.toLowerCase() === w
    );
    const res = await fetch("/api/split-requests/sync", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: walletLower, requests }),
    });
    if (!res.ok) console.warn("[cloud-sync] split-requests push", await res.text());
  } catch (e) {
    console.warn("[cloud-sync] split-requests push", e);
  }
}

export async function pushProfileToCloud(
  walletAddress: string,
  fields: {
    displayName?: string;
    email?: string;
    emailRemindersOptIn?: boolean;
  }
): Promise<void> {
  if (!isCloudSyncConfigured()) return;
  const walletLower = walletAddress.toLowerCase();
  const res = await fetch("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress: walletLower, ...fields }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Profile sync failed");
  }
}

export async function deleteProfileFromCloud(
  walletAddress: string
): Promise<void> {
  if (!isCloudSyncConfigured()) return;
  const walletLower = walletAddress.toLowerCase();
  const res = await fetch("/api/profile", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress: walletLower }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Profile delete failed");
  }
}

export type CreateSplitParams = {
  chainId: number;
  billId: string;
  splitName: string;
  creatorAddress: string;
  participants: string[];
  amountUsdc: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  customReminder?: string;
};

export async function remoteCreateSplitRequests(
  params: CreateSplitParams
): Promise<{
  requests: import("@/lib/requests").SplitRequest[];
  notifications: import("@/lib/notifications").NotificationItem[];
}> {
  const walletLower = params.creatorAddress.toLowerCase();
  const basePayload = { walletAddress: walletLower, ...params };

  const sendCreate = async (payload: Record<string, unknown>) =>
    fetch("/api/split-requests/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

  let res = await sendCreate(basePayload);
  if ((res.status === 401 || res.status === 403) && signMessageRef) {
    const auth = await getWalletAuthPayload(walletLower);
    res = await sendCreate({ ...basePayload, ...auth });
  }

  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || "Split create sync failed");
  }
  return res.json();
}

export async function remoteMarkSplitRequestPaid(
  params: import("@/lib/requests").MarkSplitRequestPaidParams
): Promise<{
  request: import("@/lib/requests").SplitRequest | null;
  notification: import("@/lib/notifications").NotificationItem;
}> {
  const walletLower = params.participantAddress.toLowerCase();
  const res = await fetch("/api/split-requests/mark-paid", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress: walletLower, ...params }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error || "Mark paid sync failed");
  }
  return res.json();
}
