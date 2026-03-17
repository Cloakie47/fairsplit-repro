"use client";

import { createConfig, http } from "wagmi";
import { injected, metaMask, coinbaseWallet, walletConnect } from "wagmi/connectors";
import { defineChain } from "viem";
import { baseSepolia } from "viem/chains";
import { Attribution } from "ox/erc8021";
import { SUPPORTED_CHAINS } from "@/lib/chains";

const BUILDER_CODE = process.env.NEXT_PUBLIC_BUILDER_CODE?.trim();
const DATA_SUFFIX = BUILDER_CODE
  ? Attribution.toDataSuffix({ codes: [BUILDER_CODE] })
  : undefined;

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

const tempoTestnet = defineChain({
  id: SUPPORTED_CHAINS.tempoTestnet.id,
  name: SUPPORTED_CHAINS.tempoTestnet.name,
  nativeCurrency: { name: "USD", symbol: "USD", decimals: 18 },
  rpcUrls: {
    default: { http: [SUPPORTED_CHAINS.tempoTestnet.rpc] },
  },
  blockExplorers: {
    default: { name: "Tempo Explorer", url: "https://explore.tempo.xyz" },
  },
});

const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export const wagmiConfig = createConfig({
  chains: [baseSepolia, arcTestnet, tempoTestnet],
  ...(DATA_SUFFIX && { dataSuffix: DATA_SUFFIX }),
  connectors: [
    metaMask({ dappMetadata: { name: "FairSplit" } }),
    coinbaseWallet({ appName: "FairSplit" }),
    ...(WALLETCONNECT_PROJECT_ID
      ? [walletConnect({ projectId: WALLETCONNECT_PROJECT_ID })]
      : []),
    injected({ shimDisconnect: true }),
  ],
  transports: {
    [baseSepolia.id]: http(),
    [arcTestnet.id]: http(),
    [tempoTestnet.id]: http(),
  },
});
