"use client";

import { useEffect } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected, metaMask } from "wagmi/connectors";
import { defineChain } from "viem";
import { baseSepolia } from "viem/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { sdk } from "@farcaster/miniapp-sdk";
import { Attribution } from "ox/erc8021";
import { SUPPORTED_CHAINS } from "@/lib/chains";

const arcTestnet = defineChain({
  id: SUPPORTED_CHAINS.arcTestnet.id,
  name: SUPPORTED_CHAINS.arcTestnet.name,
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [SUPPORTED_CHAINS.arcTestnet.rpc] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
});

const BUILDER_CODE = process.env.NEXT_PUBLIC_BASE_BUILDER_CODE;
const DATA_SUFFIX = BUILDER_CODE
  ? Attribution.toDataSuffix({ codes: [BUILDER_CODE] })
  : undefined;

const config = createConfig({
  chains: [baseSepolia, arcTestnet],
  connectors: [
    metaMask({
      dappMetadata: {
        name: "FairSplit",
      },
    }),
    injected({ shimDisconnect: true }),
  ],
  transports: {
    [baseSepolia.id]: http(),
    [arcTestnet.id]: http(),
  },
  ...(DATA_SUFFIX ? { dataSuffix: DATA_SUFFIX } : {}),
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let cancelled = false;

    const signalReady = async () => {
      try {
        await sdk.actions.ready();
      } catch {
        // Ignore when running outside a Farcaster/Base Mini App client.
      }
    };

    if (!cancelled) {
      void signalReady();
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
