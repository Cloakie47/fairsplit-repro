"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useChainTheme, CHAIN_GRADIENTS, CHAIN_ACCENT } from "@/lib/theme";
import { WalletConnectSafe } from "./WalletConnectSafe";
import { ProfileSetup } from "./ProfileSetup";
import { NotificationBell } from "./NotificationBell";

type LayoutShellProps = {
  children: React.ReactNode;
};

export function LayoutShell({ children }: LayoutShellProps) {
  const theme = useChainTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const resolvedTheme = mounted ? theme : "neutral";
  const gradient = CHAIN_GRADIENTS[resolvedTheme];
  const accent = CHAIN_ACCENT[resolvedTheme];

  return (
    <div className={`relative min-h-screen overflow-hidden bg-gradient-to-br ${gradient} transition-colors duration-500`}>
      <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-white/40 blur-3xl" />
      <div className={`pointer-events-none absolute -right-20 top-16 h-64 w-64 rounded-full ${accent.light} opacity-60 blur-3xl`} />
      <header className="border-b border-white/40 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className={`text-2xl font-semibold tracking-tight ${accent.text} transition-colors`}
            >
              FairySplit
            </Link>
            <Link
              href="/confidential"
              className="rounded-xl bg-black px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800"
            >
              Confidential Wallet
            </Link>
            <Link
              href="/activity"
              className="rounded-xl bg-black px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800"
            >
              Activity
            </Link>
            <Link
              href="/requests"
              className="rounded-xl bg-black px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800"
            >
              Requests
            </Link>
            <Link
              href="/friends"
              className="rounded-xl bg-black px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800"
            >
              Friends
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <WalletConnectSafe accent={accent} />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-5 py-10">{children}</main>
      <ProfileSetup />
    </div>
  );
}
