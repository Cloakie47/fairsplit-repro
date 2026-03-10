/**
 * Chain configuration for supported testnets.
 * USDC addresses from Circle: https://developers.circle.com/stablecoins/usdc-contract-addresses
 */

const TEMPO_BILLSPLITTER_ADDRESS = process.env.NEXT_PUBLIC_TEMPO_BILLSPLITTER_ADDRESS;

function isAddressLike(value: string | undefined): value is string {
  return !!value && /^0x[a-fA-F0-9]{40}$/.test(value);
}

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
  tempoTestnet: {
    id: 42431,
    name: "Tempo Testnet",
    rpc: "https://rpc.moderato.tempo.xyz",
    theme: "tempo" as const,
  },
} as const;

export type SupportedToken = {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  confidentialSymbol: string;
};

export const TEMPO_STABLE_TOKENS = [
  {
    name: "pathUSD",
    symbol: "pathUSD",
    address: "0x20c0000000000000000000000000000000000000",
    decimals: 6,
    confidentialSymbol: "cpathUSD",
  },
  {
    name: "AlphaUSD",
    symbol: "AlphaUSD",
    address: "0x20c0000000000000000000000000000000000001",
    decimals: 6,
    confidentialSymbol: "cAlphaUSD",
  },
  {
    name: "BetaUSD",
    symbol: "BetaUSD",
    address: "0x20c0000000000000000000000000000000000002",
    decimals: 6,
    confidentialSymbol: "cBetaUSD",
  },
  {
    name: "ThetaUSD",
    symbol: "ThetaUSD",
    address: "0x20c0000000000000000000000000000000000003",
    decimals: 6,
    confidentialSymbol: "cThetaUSD",
  },
] as const satisfies readonly SupportedToken[];

export const TOKENS_BY_CHAIN: Record<number, readonly SupportedToken[]> = {
  [SUPPORTED_CHAINS.baseSepolia.id]: [
    {
      name: "USD Coin",
      symbol: "USDC",
      address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      decimals: 6,
      confidentialSymbol: "cUSDC",
    },
  ],
  [SUPPORTED_CHAINS.arcTestnet.id]: [
    {
      name: "USD Coin",
      symbol: "USDC",
      address: "0x3600000000000000000000000000000000000000",
      decimals: 6,
      confidentialSymbol: "cUSDC",
    },
  ],
  [SUPPORTED_CHAINS.tempoTestnet.id]: TEMPO_STABLE_TOKENS,
};

export function getTokensForChain(chainId?: number): readonly SupportedToken[] {
  if (!chainId) return [];
  return TOKENS_BY_CHAIN[chainId] ?? [];
}

export function getDefaultTokenForChain(chainId?: number): SupportedToken | null {
  return getTokensForChain(chainId)[0] ?? null;
}

export function getTokenByAddress(chainId: number | undefined, address: string | undefined): SupportedToken | null {
  if (!chainId || !address) return null;
  const next = getTokensForChain(chainId).find(
    (token) => token.address.toLowerCase() === address.toLowerCase()
  );
  return next ?? null;
}

export const USDC_ADDRESSES: Record<number, string> = {
  [SUPPORTED_CHAINS.baseSepolia.id]: TOKENS_BY_CHAIN[SUPPORTED_CHAINS.baseSepolia.id][0]!.address,
  [SUPPORTED_CHAINS.arcTestnet.id]: TOKENS_BY_CHAIN[SUPPORTED_CHAINS.arcTestnet.id][0]!.address,
};

export const CONTRACT_ADDRESSES: Record<number, string> = {
  [SUPPORTED_CHAINS.baseSepolia.id]: "0xe432ed508fBF408DD022dd4b6c25b0838F175a91",
  [SUPPORTED_CHAINS.arcTestnet.id]: "0x354e80A8B972941654B79DF065F826E9AdC4F21c",
  ...(isAddressLike(TEMPO_BILLSPLITTER_ADDRESS)
    ? { [SUPPORTED_CHAINS.tempoTestnet.id]: TEMPO_BILLSPLITTER_ADDRESS }
    : {}),
};

export function isBillSplitterConfigured(chainId?: number): boolean {
  if (!chainId) return false;
  return !!CONTRACT_ADDRESSES[chainId];
}
