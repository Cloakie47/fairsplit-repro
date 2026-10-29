"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { LayoutShell } from "@/components/LayoutShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

import {
  deleteProfileFromCloud,
  isCloudSyncConfigured,
  pushProfileToCloud,
} from "@/lib/cloud-sync";
import { getProfile, createOrUpdateProfile, clearProfile } from "@/lib/profile";

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [emailReminders, setEmailReminders] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  useEffect(() => {
    if (!address) return;
    const profile = getProfile(address);
    if (profile) {
      setDisplayName(profile.displayName ?? "");
      setEmail(profile.email ?? "");
      setEmailReminders(profile.emailRemindersOptIn ?? false);
    }
  }, [address]);

  const onSave = async () => {
    if (!address) return;
    setError(null);
    setBusy(true);
    try {
      createOrUpdateProfile(address, {
        displayName: displayName.trim() || undefined,
        email: email.trim() || undefined,
        emailRemindersOptIn: emailReminders,
      });
      if (isCloudSyncConfigured()) {
        await pushProfileToCloud(address, {
          displayName: displayName.trim() || undefined,
          email: email.trim() || undefined,
          emailRemindersOptIn: emailReminders,
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setBusy(false);
    }
  };

  const onClear = async () => {
    if (!address) return;
    setError(null);
    setBusy(true);
    try {
      if (isCloudSyncConfigured()) {
        await deleteProfileFromCloud(address);
      }
      clearProfile(address);
      setDisplayName("");
      setEmail("");
      setEmailReminders(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not clear profile");
    } finally {
      setBusy(false);
    }
  };

  const onConfirmClear = async () => {
    await onClear();
    setShowClearModal(false);
  };

  return (
    <LayoutShell>
      <p className="label-text text-brand-red">■ FairSplit / Profile</p>
      <h1 className="mt-2 font-grotesk text-page-title font-bold uppercase text-brand-black underline decoration-brand-red decoration-4 underline-offset-4">
        Profile
      </h1>
      <p className="mt-2 text-body text-brand-ink">
        Manage your display name, email, and notification preferences.
        {isCloudSyncConfigured() && (
          <span className="mt-1 block font-mono text-xs text-brand-muted">
            Saving to cloud asks for a wallet signature (no gas).
          </span>
        )}
      </p>

      {!isConnected && (
        <Card className="mt-6 p-6">
          <p className="text-body text-brand-ink">Connect your wallet to edit your profile.</p>
        </Card>
      )}

      {isConnected && address && (
        <Card className="relative mt-6 p-6">
          <button
            type="button"
            onClick={() => setShowClearModal(true)}
            disabled={busy}
            className="absolute right-4 top-4 font-mono text-xs font-extrabold uppercase tracking-widest text-brand-muted underline hover:text-brand-red disabled:opacity-50"
          >
            clear
          </button>
          <p className="label-text text-brand-green">// Your Profile</p>

          <div className="mt-4 border-2 border-brand-black bg-white p-3">
            <p className="label-text text-brand-muted">Wallet Address</p>
            <p className="mt-1 font-mono text-xs font-bold text-brand-black">
              {address}
            </p>
          </div>

          <div className="mt-5 space-y-4">
            <Input
              label="Display Name"
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your Name"
            />

            <Input
              label="Email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEmailReminders(!emailReminders)}
                className="flex h-5 w-5 items-center justify-center border-2 border-brand-black bg-white transition-all duration-75 hover:bg-brand-yellow"
              >
                {emailReminders && (
                  <span className="text-brand-black">✓</span>
                )}
              </button>
              <span className="font-grotesk text-sm text-brand-ink">
                Opt-in to email reminders for split requests
              </span>
            </div>

            {error && (
              <div className="border-2 border-brand-red bg-white p-2 font-mono text-xs text-brand-red">
                {error}
              </div>
            )}

            {saved && (
              <div className="border-2 border-brand-green bg-white p-2 font-mono text-xs text-brand-green">
                Profile saved successfully.
              </div>
            )}

            <Button className="w-full" variant="black" size="md" onClick={() => void onSave()} disabled={busy}>
              {busy ? "Saving…" : "Save Profile →"}
            </Button>
          </div>
        </Card>
      )}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md border-2 border-brand-black bg-[#f5f5f2] p-5 shadow-[6px_6px_0_#0A0A0A]">
            <h2 className="font-grotesk text-lg font-bold uppercase text-brand-black">
              Clear local data?
            </h2>
            <p className="mt-3 text-body text-brand-ink">
              This will reset your profile settings.
              <br />
              Your splits and friends are safely stored and will not be affected.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="white"
                size="sm"
                onClick={() => setShowClearModal(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button variant="red" size="sm" onClick={() => void onConfirmClear()} disabled={busy}>
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}
    </LayoutShell>
  );
}
