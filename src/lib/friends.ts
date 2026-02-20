"use client";

import { getProfile } from "@/lib/profile";

export type Friend = {
  ownerAddress: string;
  friendAddress: string;
  nickname: string;
  friendEmail?: string;
  createdAt: number;
};

const FRIENDS_STORAGE_KEY = "fairysplit_friends";

function normalize(address: string): string {
  return address.toLowerCase();
}

function getAllFriends(): Friend[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FRIENDS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Friend[]) : [];
  } catch {
    return [];
  }
}

function setAllFriends(friends: Friend[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(friends));
}

export function getFriends(ownerAddress: string): Friend[] {
  const owner = normalize(ownerAddress);
  return getAllFriends()
    .filter((f) => f.ownerAddress === owner)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function upsertFriend(
  ownerAddress: string,
  friendAddress: string,
  nickname: string,
  friendEmail?: string
): Friend {
  const owner = normalize(ownerAddress);
  const friend = normalize(friendAddress);
  const next: Friend = {
    ownerAddress: owner,
    friendAddress: friend,
    nickname: nickname.trim(),
    friendEmail: friendEmail?.trim() || undefined,
    createdAt: Date.now(),
  };

  const existing = getAllFriends();
  const rest = existing.filter(
    (item) => !(item.ownerAddress === owner && item.friendAddress === friend)
  );
  const updated = [next, ...rest];
  setAllFriends(updated);
  return next;
}

export function removeFriend(ownerAddress: string, friendAddress: string): void {
  const owner = normalize(ownerAddress);
  const friend = normalize(friendAddress);
  const next = getAllFriends().filter(
    (item) => !(item.ownerAddress === owner && item.friendAddress === friend)
  );
  setAllFriends(next);
}

export function getFriendByAddress(
  ownerAddress: string,
  friendAddress: string
): Friend | null {
  const owner = normalize(ownerAddress);
  const friend = normalize(friendAddress);
  return (
    getAllFriends().find(
      (item) => item.ownerAddress === owner && item.friendAddress === friend
    ) ?? null
  );
}

export function getFriendEmail(
  ownerAddress: string,
  friendAddress: string
): string | undefined {
  return getFriendByAddress(ownerAddress, friendAddress)?.friendEmail;
}

export function resolveDisplayName(
  viewerAddress: string | null | undefined,
  targetAddress: string
): string {
  const target = normalize(targetAddress);
  const viewer = viewerAddress ? normalize(viewerAddress) : null;
  if (viewer && viewer === target) return "You";

  if (viewer) {
    const friend = getFriends(viewer).find((f) => f.friendAddress === target);
    if (friend) return friend.nickname;
  }

  const profile = getProfile(target);
  if (profile?.displayName) return profile.displayName;
  return `${target.slice(0, 6)}...${target.slice(-4)}`;
}

