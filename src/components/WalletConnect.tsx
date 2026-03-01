"use client";

import {
  useConnect,
  useAccount,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { CHAIN_ACCENT, ChainTheme } from "@/lib/theme";
import { SUPPORTED_CHAINS } from "@/lib/chains";
import { getProfile } from "@/lib/profile";
import { resolveAddressToPreferredName } from "@/lib/nameService";
import { useCallback, useEffect, useState } from "react";

type Accent = (typeof CHAIN_ACCENT)[ChainTheme];

type WalletConnectProps = {
  accent?: Accent;
};

export function WalletConnect({ accent = CHAIN_ACCENT.neutral }: WalletConnectProps) {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isResolvingName, setIsResolvingName] = useState(false);

  const truncate = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const refreshDisplayName = useCallback(
    async (allowAutoRetry: boolean) => {
      if (!address) {
        setDisplayName(null);
        return;
      }

      const profile = getProfile(address);
      const localName = profile?.displayName?.trim() || null;
      if (localName) {
        setDisplayName(localName);
        return;
      }

      setIsResolvingName(true);
      try {
        const resolvedName = await resolveAddressToPreferredName(address, chainId);
        setDisplayName(resolvedName);

        if (allowAutoRetry && !resolvedName) {
          window.setTimeout(() => {
            void refreshDisplayName(false);
          }, 2500);
        }
      } catch {
        setDisplayName(null);
      } finally {
        setIsResolvingName(false);
      }
    },
    [address, chainId]
  );

  useEffect(() => {
    let cancelled = false;
    void refreshDisplayName(true);
    const listener = () => {
      if (!cancelled) {
        void refreshDisplayName(true);
      }
    };
    window.addEventListener("fairysplit-profile-updated", listener);
    window.addEventListener("storage", listener);
    window.addEventListener("fairysplit-resolved-name-updated", listener);
    return () => {
      cancelled = true;
      window.removeEventListener("fairysplit-profile-updated", listener);
      window.removeEventListener("storage", listener);
      window.removeEventListener("fairysplit-resolved-name-updated", listener);
    };
  }, [refreshDisplayName]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setIsMobile(window.matchMedia("(max-width: 767px)").matches);
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  const isBase = chainId === SUPPORTED_CHAINS.baseSepolia.id;
  const isArc = chainId === SUPPORTED_CHAINS.arcTestnet.id;

  // Prefer deterministic connector ordering to avoid extension conflicts.
  const preferredConnector =
    connectors.find((c) => c.id === "metaMask") ??
    connectors.find((c) => c.type === "injected") ??
    connectors[0];

  const nameText = displayName ?? (address ? truncate(address) : "");
  const refreshNameButton = (
    <button
      type="button"
      onClick={() => void refreshDisplayName(false)}
      disabled={isResolvingName}
      aria-label="Refresh resolved name"
      title="Refresh name"
      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-stone-200 text-xs text-stone-500 transition hover:bg-stone-50 hover:text-stone-700 disabled:opacity-50"
    >
      {isResolvingName ? "…" : "↻"}
    </button>
  );

  if (isConnected && address) {
    if (isMobile) {
      return (
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {!isBase && !isArc && switchChain && (
            <button
              onClick={() => switchChain({ chainId: SUPPORTED_CHAINS.baseSepolia.id })}
              className="h-9 rounded-xl border border-stone-300 bg-white px-3 text-xs font-semibold text-stone-800 transition hover:bg-stone-100"
            >
              Switch to Base
            </button>
          )}
          <div className="flex h-10 items-center justify-between gap-2 rounded-xl border border-stone-300 bg-white px-3">
            <select
              value={chainId ?? ""}
              onChange={(e) => switchChain?.({ chainId: Number(e.target.value) })}
              className="h-full min-w-0 border-0 bg-transparent text-sm font-semibold text-stone-800 focus:outline-none"
            >
              <option value={SUPPORTED_CHAINS.baseSepolia.id}>Base</option>
              <option value={SUPPORTED_CHAINS.arcTestnet.id}>Arc</option>
            </select>
            <div className="flex min-w-0 items-center gap-2 border-l border-stone-200 pl-3">
              <span className="max-w-[12.5rem] truncate text-sm font-semibold text-stone-700">
                {nameText}
              </span>
              {refreshNameButton}
            </div>
          </div>
          <button
            onClick={() => disconnect()}
            className="h-9 self-end rounded-xl border border-stone-300 bg-white px-3 text-xs font-semibold text-stone-800 transition hover:bg-stone-100"
          >
            Disconnect
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {!isBase && !isArc && switchChain && (
          <button
            onClick={() => switchChain({ chainId: SUPPORTED_CHAINS.baseSepolia.id })}
            className="h-10 rounded-xl border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
          >
            Switch to Base
          </button>
        )}
        <div className="flex h-10 items-center gap-2 rounded-xl border border-stone-300 bg-white px-3">
          <select
            value={chainId ?? ""}
            onChange={(e) => switchChain?.({ chainId: Number(e.target.value) })}
            className="h-full border-0 bg-transparent text-sm font-semibold text-stone-800 focus:outline-none"
          >
            <option value={SUPPORTED_CHAINS.baseSepolia.id}>Base</option>
            <option value={SUPPORTED_CHAINS.arcTestnet.id}>Arc</option>
          </select>
          <div className="flex min-w-0 items-center gap-2 border-l border-stone-200 pl-3">
            <span className="max-w-[15rem] truncate text-sm font-semibold text-stone-700">
              {nameText}
            </span>
            {refreshNameButton}
          </div>
        </div>
        <button
          onClick={() => disconnect()}
          className="h-10 rounded-xl border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
        >
          Disconnect
        </button>
      </div>
    );
  }

  if (!preferredConnector) {
    return (
      <div className="rounded-2xl border border-amber-300/70 bg-amber-50/90 px-6 py-3 text-center">
        <p className="text-sm font-semibold text-amber-900">
          No wallet detected. Install MetaMask or another Web3 wallet.
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => connect({ connector: preferredConnector })}
      disabled={isPending}
      className="nav-pill h-10 px-5 text-sm font-bold disabled:opacity-60 md:px-8 md:py-3.5 md:text-base"
    >
      {isPending ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}
