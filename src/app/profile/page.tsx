"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { LayoutShell } from "@/components/LayoutShell";
import { createOrUpdateProfile, getProfile } from "@/lib/profile";

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [emailReminders, setEmailReminders] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setDisplayName("");
      setEmail("");
      setEmailReminders(false);
      return;
    }
    const profile = getProfile(address);
    setDisplayName(profile?.displayName ?? "");
    setEmail(profile?.email ?? "");
    setEmailReminders(profile?.emailRemindersOptIn ?? false);
  }, [address]);

  const onSave = () => {
    if (!address) return;
    createOrUpdateProfile(address, {
      displayName: displayName.trim() || undefined,
      email: email.trim() || undefined,
      emailRemindersOptIn: emailReminders,
    });
    setStatus("Profile saved.");
  };

  return (
    <LayoutShell>
      <section className="mx-auto w-full max-w-xl rounded-2xl border border-stone-200 bg-white/95 p-5 md:p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Profile</h1>
        <p className="mt-2 text-sm text-stone-600">
          Set your nickname and email. Your nickname shows in the wallet badge instead of your
          wallet address.
        </p>

        {!isConnected ? (
          <p className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
            Connect your wallet to edit your profile.
          </p>
        ) : (
          <div className="mt-6 space-y-5">
            <div>
              <label htmlFor="profile-display-name" className="block text-sm font-medium text-stone-700">
                Nickname
              </label>
              <input
                id="profile-display-name"
                name="profile-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Cloakie"
                className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-pink-200"
              />
            </div>

            <div>
              <label htmlFor="profile-email" className="block text-sm font-medium text-stone-700">
                Email
              </label>
              <input
                id="profile-email"
                name="profile-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-pink-200"
              />
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
              <input
                id="profile-email-reminders"
                name="profile-email-reminders"
                type="checkbox"
                checked={emailReminders}
                onChange={(e) => setEmailReminders(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <span className="text-sm text-stone-700">Receive email reminders for unpaid splits</span>
            </label>

            <button
              type="button"
              onClick={onSave}
              className="inline-flex items-center justify-center rounded-2xl border border-[#d56ac7] bg-[#f7b8ee] px-5 py-2.5 text-sm font-semibold text-stone-900 transition hover:brightness-95"
            >
              Save profile
            </button>

            {status && <p className="text-sm font-medium text-stone-700">{status}</p>}
          </div>
        )}
      </section>
    </LayoutShell>
  );
}
