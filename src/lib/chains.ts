/**
 * Chain configuration for Base and ARC testnets.
 * USDC addresses from Circle: https://developers.circle.com/stablecoins/usdc-contract-addresses
 */

export const SUPPORTED_CHAINS = {
  baseSepolia: {
    id: 84532,
    name: "Base Sepolia",
    rpc: "https://sepolia.base.org",
    theme: "blue" as const,
  },
  arcTestnet: {
    id: 5042002,
    name: "ARC Testnet",
    rpc: "https://rpc.testnet.arc.network",
    theme: "orange" as const,
  },
} as const;

export const USDC_ADDRESSES: Record<number, string> = {
  [SUPPORTED_CHAINS.baseSepolia.id]: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  [SUPPORTED_CHAINS.arcTestnet.id]: "0x3600000000000000000000000000000000000000",
};

export const CONTRACT_ADDRESSES: Record<number, string> = {
  [SUPPORTED_CHAINS.baseSepolia.id]: "0xe432ed508fBF408DD022dd4b6c25b0838F175a91",
  [SUPPORTED_CHAINS.arcTestnet.id]: "0x354e80A8B972941654B79DF065F826E9AdC4F21c",
};
