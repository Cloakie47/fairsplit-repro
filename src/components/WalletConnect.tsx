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
import { useEffect, useState } from "react";

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

  const truncate = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  useEffect(() => {
    const refreshProfile = () => {
      if (!address) {
        setDisplayName(null);
        return;
      }
      const profile = getProfile(address);
      setDisplayName(profile?.displayName?.trim() || null);
    };
    refreshProfile();
    window.addEventListener("fairysplit-profile-updated", refreshProfile);
    window.addEventListener("storage", refreshProfile);
    return () => {
      window.removeEventListener("fairysplit-profile-updated", refreshProfile);
      window.removeEventListener("storage", refreshProfile);
    };
  }, [address]);

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

  if (isConnected && address) {
    if (isMobile) {
      return (
        <div className="flex w-full flex-col items-stretch gap-2">
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
            <span className="max-w-[10.5rem] truncate border-l border-stone-200 pl-3 text-sm font-semibold text-stone-700">
              {displayName ?? truncate(address)}
            </span>
          </div>
          <button
            onClick={() => disconnect()}
            className="h-9 rounded-xl border border-stone-300 bg-white px-3 text-xs font-semibold text-stone-800 transition hover:bg-stone-100"
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
          <span className="max-w-28 truncate border-l border-stone-200 pl-3 text-sm font-semibold text-stone-700">
            {displayName ?? truncate(address)}
          </span>
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
