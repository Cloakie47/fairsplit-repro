"use client";

import {
  useConnect,
  useAccount,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { CHAIN_ACCENT, ChainTheme } from "@/lib/theme";
import { SUPPORTED_CHAINS } from "@/lib/chains";

type Accent = (typeof CHAIN_ACCENT)[ChainTheme];

type WalletConnectProps = {
  accent?: Accent;
};

export function WalletConnect({ accent = CHAIN_ACCENT.neutral }: WalletConnectProps) {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const truncate = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const isBase = chainId === SUPPORTED_CHAINS.baseSepolia.id;
  const isArc = chainId === SUPPORTED_CHAINS.arcTestnet.id;

  // Prefer deterministic connector ordering to avoid extension conflicts.
  const preferredConnector =
    connectors.find((c) => c.id === "metaMask") ??
    connectors.find((c) => c.type === "injected") ??
    connectors[0];

  if (isConnected && address) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {!isBase && !isArc && switchChain && (
          <button
            onClick={() => switchChain({ chainId: SUPPORTED_CHAINS.baseSepolia.id })}
            className="nav-pill px-4 py-2.5 text-sm font-semibold"
          >
            Switch to Base
          </button>
        )}
        <div className="flex items-center gap-2 rounded-xl border border-white/80 bg-white/88 px-4 py-2.5 shadow-md backdrop-blur">
          <select
            value={chainId ?? ""}
            onChange={(e) => switchChain?.({ chainId: Number(e.target.value) })}
            className="border-0 bg-transparent text-sm font-semibold text-stone-800 focus:outline-none"
          >
            <option value={SUPPORTED_CHAINS.baseSepolia.id}>Base</option>
            <option value={SUPPORTED_CHAINS.arcTestnet.id}>Arc</option>
          </select>
          <span className="border-l border-stone-200 pl-3 text-sm font-semibold text-stone-700">
            {truncate(address)}
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          className="nav-pill px-4 py-2.5 text-sm font-semibold"
        >
          Disconnect
        </button>
      </div>
    );
  }

  if (!preferredConnector) {
    return (
      <div className="rounded-2xl border border-amber-300/70 bg-amber-50/90 px-6 py-3 text-center shadow-sm">
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
      className="nav-pill px-8 py-3.5 text-base font-bold disabled:opacity-60"
    >
      {isPending ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}
