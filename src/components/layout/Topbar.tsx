"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { useCallback, useEffect, useState } from "react";
import { SUPPORTED_CHAINS } from "@/lib/chains";
import { getProfile } from "@/lib/profile";
import { resolveAddressToPreferredName } from "@/lib/nameService";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { NotificationBell } from "@/components/NotificationBell";

function getChainLabel(chainId?: number): string {
  if (chainId === SUPPORTED_CHAINS.baseSepolia.id) return "BASE";
  if (chainId === SUPPORTED_CHAINS.arcTestnet.id) return "ARC";
  if (chainId === SUPPORTED_CHAINS.tempoTestnet.id) return "TEMPO";
  return "NETWORK";
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function Topbar() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [displayName, setDisplayName] = useState<string | null>(null);

  const refreshDisplayName = useCallback(async () => {
    if (!address) {
      setDisplayName(null);
      return;
    }
    const profile = getProfile(address);
    if (profile?.displayName?.trim()) {
      setDisplayName(profile.displayName);
      return;
    }
    try {
      const resolved = await resolveAddressToPreferredName(address, chainId);
      setDisplayName(resolved);
    } catch {
      setDisplayName(null);
    }
  }, [address, chainId]);

  useEffect(() => {
    void refreshDisplayName();
    const onProfileUpdate = () => void refreshDisplayName();
    window.addEventListener("fairysplit-profile-updated", onProfileUpdate);
    window.addEventListener("fairysplit-resolved-name-updated", onProfileUpdate);
    return () => {
      window.removeEventListener("fairysplit-profile-updated", onProfileUpdate);
      window.removeEventListener("fairysplit-resolved-name-updated", onProfileUpdate);
    };
  }, [refreshDisplayName]);

  const preferredConnector =
    connectors.find((c) => c.id === "metaMask") ??
    connectors.find((c) => c.type === "injected") ??
    connectors[0];

  return (
    <header className="flex items-center justify-between border-b-2 border-brand-black bg-brand-yellow px-4 py-3 md:px-6">
      <div className="flex items-center gap-3 md:hidden">
        <div className="border-2 border-brand-black bg-brand-black px-3 py-1.5">
          <span className="font-grotesk text-lg font-bold uppercase text-brand-yellow">
            FairSplit
          </span>
        </div>
        {isConnected && chainId && (
          <Badge variant="red">{getChainLabel(chainId)}</Badge>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {isConnected && address ? (
          <>
            <NotificationBell />

            <div className="flex items-center border-2 border-brand-black bg-white">
              <span className="label-text px-3 text-brand-black">
                ■ {getChainLabel(chainId)}
              </span>
              <select
                value={chainId ?? ""}
                onChange={(e) =>
                  switchChain?.({ chainId: Number(e.target.value) })
                }
                className="h-full border-l-2 border-brand-black bg-transparent px-2 py-2 font-mono text-label font-bold focus:outline-none"
              >
                <option value={SUPPORTED_CHAINS.baseSepolia.id}>Base</option>
                <option value={SUPPORTED_CHAINS.arcTestnet.id}>Arc</option>
                <option value={SUPPORTED_CHAINS.tempoTestnet.id}>Tempo</option>
              </select>
            </div>

            <div className="border-2 border-brand-black bg-white px-3 py-2">
              <span className="font-mono text-xs font-bold text-brand-black">
                {displayName ?? truncateAddress(address)}
              </span>
            </div>

            <Button variant="black" size="sm" onClick={() => disconnect()}>
              Disconnect
            </Button>
          </>
        ) : (
          <Button
            variant="black"
            size="md"
            onClick={() =>
              preferredConnector &&
              connect({ connector: preferredConnector })
            }
            disabled={isPending || !preferredConnector}
          >
            {isPending ? "Connecting..." : "Connect Wallet"}
          </Button>
        )}
      </div>
    </header>
  );
}
