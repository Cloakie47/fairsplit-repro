"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { getProfile, createOrUpdateProfile } from "@/lib/profile";
import { useChainTheme, CHAIN_ACCENT } from "@/lib/theme";

export function ProfileSetup() {
  const { address, isConnected } = useAccount();
  const theme = useChainTheme();
  const accent = CHAIN_ACCENT[theme];
  const [show, setShow] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [emailReminders, setEmailReminders] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isConnected && address) {
      const profile = getProfile(address);
      if (!profile) {
        setShow(true);
      } else {
        setDisplayName(profile.displayName ?? "");
        setEmail(profile.email ?? "");
        setEmailReminders(profile.emailRemindersOptIn ?? false);
      }
    } else {
      setShow(false);
    }
  }, [isConnected, address]);

  const handleSave = () => {
    if (!address) return;
    createOrUpdateProfile(address, {
      displayName: displayName.trim() || undefined,
      email: email.trim() || undefined,
      emailRemindersOptIn: emailReminders,
    });
    setSaved(true);
    setTimeout(() => {
      setShow(false);
      setSaved(false);
    }, 500);
  };

  const handleSkip = () => {
    if (!address) return;
    createOrUpdateProfile(address, {});
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white p-7">
        <h3 className="text-lg font-semibold text-stone-900">
          Complete your profile
        </h3>
        <p className="mt-1 text-sm text-stone-500">
          Optional. You can change this later.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700">
              Display name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex"
              className={`mt-1 w-full rounded-2xl border border-stone-200 px-4 py-3 text-stone-900 ${accent.focus}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">
              Email (optional, for reminders)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={`mt-1 w-full rounded-2xl border border-stone-200 px-4 py-3 text-stone-900 ${accent.focus}`}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={emailReminders}
              onChange={(e) => setEmailReminders(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span className="text-sm text-stone-700">
              Opt in to email reminders for unpaid splits
            </span>
          </label>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSave}
            className={`rounded-2xl px-5 py-2.5 text-sm font-semibold text-white ${accent.bg} ${accent.hover} transition`}
          >
            {saved ? "Saved" : "Save"}
          </button>
          <button
            onClick={handleSkip}
            className="rounded-2xl bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
