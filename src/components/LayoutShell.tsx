"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  useEffect(() => setMounted(true), []);

  const resolvedTheme = mounted ? theme : "neutral";
  const gradient = CHAIN_GRADIENTS[resolvedTheme];
  const accent = CHAIN_ACCENT[resolvedTheme];
  const chainLabel =
    resolvedTheme === "blue" ? "Base" : resolvedTheme === "orange" ? "Arc" : "Network";
  const chainAura =
    resolvedTheme === "blue"
      ? "bg-[radial-gradient(circle_at_12%_10%,rgba(37,99,235,0.44),transparent_48%),radial-gradient(circle_at_88%_8%,rgba(96,165,250,0.35),transparent_40%)]"
      : resolvedTheme === "orange"
      ? "bg-[radial-gradient(circle_at_12%_10%,rgba(249,115,22,0.44),transparent_48%),radial-gradient(circle_at_88%_8%,rgba(251,191,36,0.35),transparent_40%)]"
      : "bg-[radial-gradient(circle_at_12%_10%,rgba(120,113,108,0.2),transparent_44%),radial-gradient(circle_at_88%_8%,rgba(120,113,108,0.14),transparent_36%)]";

  const playClick = () => {
    if (!soundEnabled || typeof window === "undefined") return;
    const AudioCtx = window.AudioContext;
    if (!AudioCtx) return;
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioCtx();
    }
    const audioContext = audioContextRef.current;
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = 520;
    gainNode.gain.value = 0.015;
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.035);
  };

  const onShellClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest("button,[role='button'],a.nav-pill")) {
      playClick();
    }
  };

  return (
    <div
      className={`relative min-h-screen overflow-hidden bg-gradient-to-br ${gradient} transition-all duration-500`}
      onClickCapture={onShellClickCapture}
    >
      <div className={`pointer-events-none absolute inset-0 opacity-95 ${chainAura} transition-all duration-500`} />
      <div
        className={`pointer-events-none absolute -right-20 top-10 h-56 w-56 rounded-full ${accent.light} opacity-45 blur-2xl transition-all duration-500`}
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <span
          className={`dandelion-seed seed-one ${resolvedTheme === "blue" ? "seed-blue" : resolvedTheme === "orange" ? "seed-orange" : "seed-neutral"}`}
        />
        <span
          className={`dandelion-seed seed-two ${resolvedTheme === "blue" ? "seed-blue" : resolvedTheme === "orange" ? "seed-orange" : "seed-neutral"}`}
        />
        <span
          className={`dandelion-seed seed-three ${resolvedTheme === "blue" ? "seed-blue" : resolvedTheme === "orange" ? "seed-orange" : "seed-neutral"}`}
        />
        <span
          className={`dandelion-seed seed-four ${resolvedTheme === "blue" ? "seed-blue" : resolvedTheme === "orange" ? "seed-orange" : "seed-neutral"}`}
        />
        <span
          className={`dandelion-seed seed-five ${resolvedTheme === "blue" ? "seed-blue" : resolvedTheme === "orange" ? "seed-orange" : "seed-neutral"}`}
        />
        <span
          className={`dandelion-seed seed-six ${resolvedTheme === "blue" ? "seed-blue" : resolvedTheme === "orange" ? "seed-orange" : "seed-neutral"}`}
        />
      </div>
      <header className="header-shell">
        <div className="mx-auto max-w-6xl px-5 py-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <Link
                  href="/"
                  className={`text-3xl font-semibold tracking-tight leading-none ${accent.text} transition-colors md:text-4xl`}
                >
                  FairSplit
                </Link>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${accent.border} ${accent.text} bg-white/90 shadow-sm`}
                >
                  {chainLabel}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <button
                  type="button"
                  onClick={() => setSoundEnabled((v) => !v)}
                  className="rounded-xl border border-white/70 bg-white/82 px-4 py-2.5 text-sm font-semibold text-stone-800 shadow-sm transition hover:bg-white"
                  aria-pressed={soundEnabled}
                  title="Toggle button click sound"
                >
                  Click sound: {soundEnabled ? "On" : "Off"}
                </button>
                <NotificationBell />
                <WalletConnectSafe accent={accent} />
              </div>
            </div>

            <nav className="overflow-x-auto">
              <div className="flex items-center gap-2 pb-1 pr-1">
                <Link href="/confidential" className="nav-pill px-4 py-2.5 text-sm font-semibold">
                  Confidential Wallet
                </Link>
                <Link href="/activity" className="nav-pill px-4 py-2.5 text-sm font-semibold">
                  Activity
                </Link>
                <Link href="/requests" className="nav-pill px-4 py-2.5 text-sm font-semibold">
                  Requests
                </Link>
                <Link href="/friends" className="nav-pill px-4 py-2.5 text-sm font-semibold">
                  Friends
                </Link>
              </div>
            </nav>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-5 py-10">{children}</main>
      <ProfileSetup />
    </div>
  );
}
