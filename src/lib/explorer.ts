import { SUPPORTED_CHAINS } from "@/lib/chains";

const TX_EXPLORER_BASES: Record<number, string> = {
  [SUPPORTED_CHAINS.baseSepolia.id]: "https://sepolia.basescan.org/tx/",
  [SUPPORTED_CHAINS.arcTestnet.id]: "https://testnet.arcscan.app/tx/",
};

export function getChainLabel(chainId?: number): string {
  if (chainId === SUPPORTED_CHAINS.baseSepolia.id) return "Base";
  if (chainId === SUPPORTED_CHAINS.arcTestnet.id) return "Arc";
  return "Unknown";
}

export function getTxExplorerUrl(chainId?: number, txHash?: string): string | null {
  if (!chainId || !txHash) return null;
  const base = TX_EXPLORER_BASES[chainId];
  if (!base) return null;
  return `${base}${txHash}`;
}
