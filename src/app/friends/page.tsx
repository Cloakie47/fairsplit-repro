"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";

import { LayoutShell } from "@/components/LayoutShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

import {
  getFriends,
  removeFriend,
  type Friend,
  upsertFriend,
} from "@/lib/friends";

function shortAddress(address: string): string {
  if (!address) return "";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function FriendsPage() {
  const { address, isConnected } = useAccount();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [newAddress, setNewAddress] = useState("");
  const [newNickname, setNewNickname] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const rows = getFriends(address);
      setFriends(rows ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load friends.");
      setFriends([]);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onAdd = async () => {
    if (!address) return;
    setError(null);
    if (!newAddress.trim()) {
      setError("Friend address is required.");
      return;
    }
    if (!newNickname.trim()) {
      setError("Nickname is required.");
      return;
    }
    try {
      upsertFriend(address, newAddress.trim(), newNickname.trim(), newEmail.trim() || undefined);
      setNewAddress("");
      setNewNickname("");
      setNewEmail("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save friend.");
    }
  };

  const onRemove = async (friendAddress: string) => {
    if (!address) return;
    try {
      removeFriend(address, friendAddress);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete friend.");
    }
  };

  return (
    <LayoutShell>
      <p className="label-text text-brand-red">■ FairSplit / Friends</p>
      <h1 className="mt-2 font-grotesk text-page-title font-bold uppercase text-brand-black underline decoration-brand-red decoration-4 underline-offset-4">
        Friends
      </h1>
      <p className="mt-2 text-body text-brand-ink">
        Manage your contacts for quick splits and payments.
      </p>

      {!isConnected && (
        <Card className="mt-6 p-6">
          <p className="text-body text-brand-ink">Connect your wallet to manage friends.</p>
        </Card>
      )}

      {isConnected && (
        <>
          <Card className="mt-6 p-6">
            <p className="label-text text-brand-green">// Add Friend</p>
            <div className="mt-3 space-y-3">
              <Input
                label="Wallet Address"
                id="friend-address"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="0x..."
              />
              <Input
                label="Nickname"
                id="friend-nickname"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                placeholder="Alice"
              />
              <Input
                label="Email (optional)"
                id="friend-email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="alice@example.com"
              />
              {error && (
                <p className="font-mono text-xs text-brand-red">{error}</p>
              )}
              <Button className="w-full" variant="black" size="md" onClick={() => void onAdd()}>
                Add Friend →
              </Button>
            </div>
          </Card>

          <div className="mt-6 space-y-3">
            {loading && (
              <Card className="p-4" hoverable={false}>
                <p className="text-body text-brand-muted">Loading friends...</p>
              </Card>
            )}
            {!loading && friends.length === 0 && (
              <Card className="p-4" hoverable={false}>
                <p className="text-body text-brand-muted">
                  No friends added yet. Add a friend to get started.
                </p>
              </Card>
            )}
            {!loading && friends.map((f) => (
              <Card
                key={f.friendAddress}
                hoverable={false}
                className="flex flex-col items-start justify-between gap-3 p-4 md:flex-row md:items-center"
              >
                <div>
                  <p className="font-grotesk text-sm font-bold text-brand-black">
                    {f.nickname?.trim() || shortAddress(f.friendAddress)}
                  </p>
                  <p className="font-mono text-xs text-brand-muted">
                    {f.friendAddress}
                  </p>
                  {f.friendEmail && (
                    <p className="font-mono text-xs text-brand-muted">
                      {f.friendEmail}
                    </p>
                  )}
                  {f.createdAt && (
                    <p className="font-mono text-xs text-brand-muted">
                      Added {new Date(f.createdAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex w-full flex-col items-stretch gap-2 md:w-auto md:flex-row md:items-center">
                  <Link className="w-full md:w-auto" href={`/pay?recipient=${encodeURIComponent(f.friendAddress)}`}>
                    <Button className="w-full md:w-auto" variant="white" size="sm">
                      Quick Pay
                    </Button>
                  </Link>
                  <Button
                    className="w-full md:w-auto"
                    variant="red"
                    size="sm"
                    onClick={() => void onRemove(f.friendAddress)}
                  >
                    Remove
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </LayoutShell>
  );
}
