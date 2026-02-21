"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { injected, metaMask } from "wagmi/connectors";
import { baseSepolia } from "wagmi/chains";
import { defineChain } from "viem";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
