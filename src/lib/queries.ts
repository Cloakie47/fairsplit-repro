"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount, useChainId } from "wagmi";
import { createPublicClient, http, type Address, formatUnits } from "viem";
import { baseSepolia } from "viem/chains";
import {
  SUPPORTED_CHAINS,
  getTokensForChain,
  type SupportedToken,
} from "@/lib/chains";
import { getActivity, type ActivityItem } from "@/lib/activity";

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

function getPublicClient(chainId: number) {
  const chain =
    chainId === SUPPORTED_CHAINS.baseSepolia.id
      ? { ...baseSepolia }
      : chainId === SUPPORTED_CHAINS.arcTestnet.id
        ? {
            id: SUPPORTED_CHAINS.arcTestnet.id,
            name: SUPPORTED_CHAINS.arcTestnet.name,
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: { default: { http: [SUPPORTED_CHAINS.arcTestnet.rpc] } },
          }
        : {
            id: SUPPORTED_CHAINS.tempoTestnet.id,
            name: SUPPORTED_CHAINS.tempoTestnet.name,
            nativeCurrency: { name: "USD", symbol: "USD", decimals: 18 },
            rpcUrls: {
              default: { http: [SUPPORTED_CHAINS.tempoTestnet.rpc] },
            },
          };

  return createPublicClient({
    chain: chain as Parameters<typeof createPublicClient>[0]["chain"],
    transport: http(),
  });
}

export type TokenBalance = {
  token: SupportedToken;
  raw: bigint;
  formatted: string;
};

async function fetchTokenBalances(
  address: Address,
  chainId: number
): Promise<TokenBalance[]> {
  const tokens = getTokensForChain(chainId);
  if (tokens.length === 0) return [];

  const client = getPublicClient(chainId);
  const results: TokenBalance[] = [];

  for (const token of tokens) {
    try {
      const raw = await client.readContract({
        address: token.address as Address,
        abi: ERC20_BALANCE_ABI,
        functionName: "balanceOf",
        args: [address],
      });
      results.push({
        token,
        raw,
        formatted: formatUnits(raw, token.decimals),
      });
    } catch {
      results.push({ token, raw: BigInt(0), formatted: "0.00" });
    }
  }

  return results;
}

export function useBalances() {
  const { address } = useAccount();
  const chainId = useChainId();

  return useQuery<TokenBalance[]>({
    queryKey: ["balances", address, chainId],
    queryFn: () => fetchTokenBalances(address as Address, chainId),
    enabled: !!address && !!chainId,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

export function useChainBalance(
  chainId: number | undefined,
  options?: { refetchIntervalMs?: number }
) {
  const { address } = useAccount();
  const refetchInterval = options?.refetchIntervalMs ?? 15_000;

  return useQuery<TokenBalance[]>({
    queryKey: ["balances", address, chainId],
    queryFn: () => fetchTokenBalances(address as Address, chainId!),
    enabled: !!address && !!chainId,
    refetchInterval,
    staleTime: Math.min(10_000, refetchInterval - 1000),
  });
}

export function useTransactionHistory() {
  const { address } = useAccount();

  return useQuery<ActivityItem[]>({
    queryKey: ["activity", address],
    queryFn: () => getActivity(address!),
    enabled: !!address,
    refetchInterval: 5_000,
    staleTime: 3_000,
  });
}
