"use client";

import { useState, useEffect } from "react";
import { WalletConnect } from "./WalletConnect";
import type { ChainTheme } from "@/lib/theme";
import { CHAIN_ACCENT } from "@/lib/theme";

type Accent = (typeof CHAIN_ACCENT)[ChainTheme];

type Props = {
  accent?: Accent;
};

/**
 * Wraps WalletConnect to avoid hydration mismatch.
 * Server has no window.ethereum, so wagmi connectors differ between server/client.
 * We only render the real component after mount on the client.
 */
export function WalletConnectSafe({ accent = CHAIN_ACCENT.neutral }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        className="h-12 w-40 rounded-2xl bg-black/10"
        style={{ minWidth: 160 }}
        aria-hidden
      />
    );
  }
  return <WalletConnect accent={accent} />;
}
