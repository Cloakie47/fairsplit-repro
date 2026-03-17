"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { LayoutShell } from "@/components/LayoutShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

import { getFriends, upsertFriend, removeFriend, type Friend } from "@/lib/friends";

export default function FriendsPage() {
  const { address, isConnected } = useAccount();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [newAddress, setNewAddress] = useState("");
  const [newNickname, setNewNickname] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!address) return;
    setFriends(getFriends(address));
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onAdd = () => {
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
    upsertFriend(address, newAddress.trim(), newNickname.trim(), newEmail.trim() || undefined);
    setNewAddress("");
    setNewNickname("");
    setNewEmail("");
    refresh();
  };

  const onRemove = (friendAddress: string) => {
    if (!address) return;
    removeFriend(address, friendAddress);
    refresh();
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
              <Button variant="black" size="md" onClick={onAdd}>
                Add Friend →
              </Button>
            </div>
          </Card>

          <div className="mt-6 space-y-3">
            {friends.length === 0 && (
              <Card className="p-4" hoverable={false}>
                <p className="text-body text-brand-muted">No friends added yet.</p>
              </Card>
            )}
            {friends.map((f) => (
              <Card key={f.friendAddress} hoverable={false} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-grotesk text-sm font-bold text-brand-black">
                    {f.nickname}
                  </p>
                  <p className="font-mono text-xs text-brand-muted">
                    {f.friendAddress}
                  </p>
                  {f.friendEmail && (
                    <p className="font-mono text-xs text-brand-muted">
                      {f.friendEmail}
                    </p>
                  )}
                </div>
                <Button
                  variant="red"
                  size="sm"
                  onClick={() => onRemove(f.friendAddress)}
                >
                  Remove
                </Button>
              </Card>
            ))}
          </div>
        </>
      )}
    </LayoutShell>
  );
}
