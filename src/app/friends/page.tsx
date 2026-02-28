"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { ethers } from "ethers";
import Link from "next/link";
import { LayoutShell } from "@/components/LayoutShell";
import { getFriends, removeFriend, upsertFriend } from "@/lib/friends";

export default function FriendsPage() {
  const { address, isConnected } = useAccount();
  const [friendAddress, setFriendAddress] = useState("");
  const [nickname, setNickname] = useState("");
  const [friendEmail, setFriendEmail] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const friends = useMemo(
    () => (address ? getFriends(address) : []),
    [address, refresh]
  );

  const onAdd = () => {
    if (!address) return;
    setError(null);
    if (!ethers.isAddress(friendAddress)) {
      setError("Friend wallet address is invalid.");
      return;
    }
    if (!nickname.trim()) {
      setError("Nickname is required.");
      return;
    }
    upsertFriend(address, friendAddress, nickname, friendEmail);
    setFriendAddress("");
    setNickname("");
    setFriendEmail("");
    setRefresh((v) => v + 1);
  };

  const onRemove = (addr: string) => {
    if (!address) return;
    removeFriend(address, addr);
    setRefresh((v) => v + 1);
  };

  return (
    <LayoutShell>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 md:text-3xl">Friends</h1>
        <Link
          href="/app"
          className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
        >
          Back home
        </Link>
      </div>

      {!isConnected ? (
        <div className="mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white/95 p-5">
          <p className="text-stone-600">Connect wallet to manage your friends list.</p>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white/95 p-5">
            <h2 className="text-lg font-semibold text-stone-900">Add friend</h2>
            <p className="mt-1 text-sm text-stone-600">
              Save a wallet address with a nickname so incoming requests are recognizable.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <input
                value={friendAddress}
                onChange={(e) => setFriendAddress(e.target.value)}
                placeholder="Friend wallet address (0x...)"
                className="rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-300"
              />
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Nickname (required)"
                className="rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-300"
              />
              <input
                value={friendEmail}
                onChange={(e) => setFriendEmail(e.target.value)}
                placeholder="Email (optional)"
                className="rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-300"
              />
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <button
              type="button"
              onClick={onAdd}
              className="mt-4 rounded-xl border border-[#d56ac7] bg-[#f7b8ee] px-4 py-2.5 text-sm font-semibold text-stone-900 transition hover:brightness-95"
            >
              Save friend
            </button>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white/95 p-5">
            <h2 className="text-lg font-semibold text-stone-900">Your friends</h2>
            {friends.length === 0 ? (
              <p className="mt-2 text-sm text-stone-600">No friends yet. Add addresses above.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {friends.map((f) => (
                  <li
                    key={`${f.ownerAddress}-${f.friendAddress}`}
                    className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-stone-900">{f.nickname}</p>
                      <p className="text-xs text-stone-600">{f.friendAddress}</p>
                      {f.friendEmail && (
                        <p className="text-xs text-stone-500">{f.friendEmail}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(f.friendAddress)}
                      className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-800 transition hover:bg-stone-100"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </LayoutShell>
  );
}

