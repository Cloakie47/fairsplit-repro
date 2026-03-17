"use client";

import { useEffect } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const signalReady = async () => {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        await sdk.actions.ready();
      } catch {
        // Running outside a Farcaster client — safe to ignore.
      }
    };
    void signalReady();
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
