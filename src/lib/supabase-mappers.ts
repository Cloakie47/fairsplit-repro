import type { Profile } from "@/lib/profile";
import type { Friend } from "@/lib/friends";
import type { ActivityItem } from "@/lib/activity";
import type { SplitRequest } from "@/lib/requests";
import type { NotificationItem } from "@/lib/notifications";

/** DB row shapes from PostgREST (snake_case) */

export function profileRowToClient(row: {
  wallet_address: string;
  display_name: string | null;
  email: string | null;
  email_reminders_opt_in: boolean | null;
}): Profile {
  return {
    walletAddress: row.wallet_address,
    displayName: row.display_name ?? undefined,
    email: row.email ?? undefined,
    emailRemindersOptIn: row.email_reminders_opt_in ?? false,
  };
}

export function friendRowToClient(row: {
  owner_address: string;
  friend_address: string;
  nickname: string;
  friend_email: string | null;
  created_at_ms: number;
}): Friend {
  return {
    ownerAddress: row.owner_address,
    friendAddress: row.friend_address,
    nickname: row.nickname,
    friendEmail: row.friend_email ?? undefined,
    createdAt: Number(row.created_at_ms),
  };
}

export function friendToRow(f: Friend): {
  owner_address: string;
  friend_address: string;
  nickname: string;
  friend_email: string | null;
  created_at_ms: number;
} {
  return {
    owner_address: f.ownerAddress.toLowerCase(),
    friend_address: f.friendAddress.toLowerCase(),
    nickname: f.nickname,
    friend_email: f.friendEmail ?? null,
    created_at_ms: f.createdAt,
  };
}

export function activityRowToClient(row: {
  id: string;
  type: string;
  title: string;
  details: string | null;
  chain_id: number | null;
  tx_hash: string | null;
  bill_id: string | null;
  timestamp_ms: number;
}): ActivityItem {
  return {
    id: row.id,
    type: row.type as ActivityItem["type"],
    title: row.title,
    details: row.details ?? undefined,
    chainId: row.chain_id ?? undefined,
    txHash: row.tx_hash ?? undefined,
    billId: row.bill_id ?? undefined,
    timestamp: Number(row.timestamp_ms),
  };
}

export function activityToRow(
  walletLower: string,
  item: ActivityItem
): {
  id: string;
  wallet_address: string;
  type: string;
  title: string;
  details: string | null;
  chain_id: number | null;
  tx_hash: string | null;
  bill_id: string | null;
  timestamp_ms: number;
} {
  return {
    id: item.id,
    wallet_address: walletLower,
    type: item.type,
    title: item.title,
    details: item.details ?? null,
    chain_id: item.chainId ?? null,
    tx_hash: item.txHash ?? null,
    bill_id: item.billId ?? null,
    timestamp_ms: item.timestamp,
  };
}

export function splitRequestRowToClient(row: {
  id: string;
  chain_id: number;
  bill_id: string;
  split_name: string;
  creator_address: string;
  participant_address: string;
  amount_usdc: string | null;
  token_address: string | null;
  token_symbol: string | null;
  is_confidential: boolean;
  status: string;
  created_at_ms: number;
  paid_at_ms: number | null;
}): SplitRequest {
  return {
    id: row.id,
    chainId: Number(row.chain_id),
    billId: row.bill_id,
    splitName: row.split_name,
    creatorAddress: row.creator_address,
    participantAddress: row.participant_address,
    amountUsdc: row.amount_usdc ?? undefined,
    tokenAddress: row.token_address ?? undefined,
    tokenSymbol: row.token_symbol ?? undefined,
    isConfidential: row.is_confidential,
    status: row.status as SplitRequest["status"],
    createdAt: Number(row.created_at_ms),
    paidAt: row.paid_at_ms != null ? Number(row.paid_at_ms) : undefined,
  };
}

export function splitRequestToRow(r: SplitRequest): Record<string, unknown> {
  return {
    id: r.id,
    chain_id: r.chainId,
    bill_id: r.billId,
    split_name: r.splitName,
    creator_address: r.creatorAddress.toLowerCase(),
    participant_address: r.participantAddress.toLowerCase(),
    amount_usdc: r.amountUsdc ?? null,
    token_address: r.tokenAddress ?? null,
    token_symbol: r.tokenSymbol ?? null,
    is_confidential: r.isConfidential,
    status: r.status,
    created_at_ms: r.createdAt,
    paid_at_ms: r.paidAt ?? null,
  };
}

export function notificationRowToClient(row: {
  id: string;
  user_address: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  related_chain_id: number | null;
  related_bill_id: string | null;
  created_at_ms: number;
}): NotificationItem {
  return {
    id: row.id,
    userAddress: row.user_address,
    type: row.type as NotificationItem["type"],
    title: row.title,
    body: row.body,
    isRead: row.is_read,
    relatedChainId: row.related_chain_id ?? undefined,
    relatedBillId: row.related_bill_id ?? undefined,
    createdAt: Number(row.created_at_ms),
  };
}

export function notificationToRow(n: NotificationItem): Record<string, unknown> {
  return {
    id: n.id,
    user_address: n.userAddress.toLowerCase(),
    type: n.type,
    title: n.title,
    body: n.body,
    is_read: n.isRead,
    related_chain_id: n.relatedChainId ?? null,
    related_bill_id: n.relatedBillId ?? null,
    created_at_ms: n.createdAt,
  };
}
