"use client";

import { SUPPORTED_CHAINS } from "@/lib/chains";
import type { EstimateResult, BridgeResult } from "@circle-fin/bridge-kit";
import type { EIP1193Provider, WalletClient } from "viem";

export type BridgeChainId =
  | typeof SUPPORTED_CHAINS.baseSepolia.id
  | typeof SUPPORTED_CHAINS.arcTestnet.id;

type ManualChainSwitchHandler = (chainId: BridgeChainId) => Promise<void>;

export const BRIDGE_ROUTE_OPTIONS = [
  {
    chainId: SUPPORTED_CHAINS.baseSepolia.id,
    label: "Base Sepolia",
    bridgeChain: "Base_Sepolia",
    gasToken: "ETH",
  },
  {
    chainId: SUPPORTED_CHAINS.arcTestnet.id,
    label: "Arc Testnet",
    bridgeChain: "Arc_Testnet",
    gasToken: "USDC",
  },
] as const;

const BRIDGE_STAGE_LABELS: Record<string, string> = {
  approve: "Approving USDC for bridging...",
  burn: "Confirming the source-chain transfer...",
  fetchAttestation: "Fetching Circle attestation...",
  mint: "Minting USDC on the destination chain...",
};

function toBridgeChainId(value: unknown): BridgeChainId | null {
  if (typeof value === "number" && isBridgeChainId(value)) return value;
  if (typeof value === "string") {
    const parsed = value.startsWith("0x") ? Number.parseInt(value, 16) : Number(value);
    return isBridgeChainId(parsed) ? parsed : null;
  }
  return null;
}

function toBridgeChainIdentifier(chainId: BridgeChainId): "Base_Sepolia" | "Arc_Testnet" {
  return chainId === SUPPORTED_CHAINS.baseSepolia.id ? "Base_Sepolia" : "Arc_Testnet";
}

function walletClientToEip1193Provider(
  walletClient: WalletClient,
  onManualChainSwitchRequired?: ManualChainSwitchHandler
): EIP1193Provider {
  return {
    request: (async (args: { method: string; params?: unknown }) => {
      if (args.method === "wallet_switchEthereumChain") {
        const switchParams = Array.isArray(args.params) ? args.params[0] : undefined;
        const requestedChainId =
          typeof switchParams === "object" && switchParams !== null && "chainId" in switchParams
            ? toBridgeChainId((switchParams as { chainId?: unknown }).chainId)
            : null;

        if (requestedChainId && onManualChainSwitchRequired) {
          await onManualChainSwitchRequired(requestedChainId);
          return null;
        }
      }

      return walletClient.request(args as never);
    }) as EIP1193Provider["request"],
    on: () => undefined,
    removeListener: () => undefined,
  };
}

export function getBridgeDestinationChainId(sourceChainId: BridgeChainId): BridgeChainId {
  return sourceChainId === SUPPORTED_CHAINS.baseSepolia.id
    ? SUPPORTED_CHAINS.arcTestnet.id
    : SUPPORTED_CHAINS.baseSepolia.id;
}

export function isBridgeChainId(chainId?: number): chainId is BridgeChainId {
  return (
    chainId === SUPPORTED_CHAINS.baseSepolia.id || chainId === SUPPORTED_CHAINS.arcTestnet.id
  );
}

export function getBridgeChainLabel(chainId: BridgeChainId): string {
  return BRIDGE_ROUTE_OPTIONS.find((item) => item.chainId === chainId)?.label ?? "Unknown";
}

export function formatBridgeStage(method: string): string {
  return BRIDGE_STAGE_LABELS[method] ?? "Processing bridge transaction...";
}

export async function estimateBridgeUsdc(params: {
  walletClient: WalletClient;
  sourceChainId: BridgeChainId;
  destinationChainId: BridgeChainId;
  amount: string;
}): Promise<EstimateResult> {
  const [{ BridgeKit }, { createViemAdapterFromProvider }] = await Promise.all([
    import("@circle-fin/bridge-kit"),
    import("@circle-fin/adapter-viem-v2"),
  ]);

  const kit = new BridgeKit();
  const adapter = await createViemAdapterFromProvider({
    provider: walletClientToEip1193Provider(params.walletClient),
    capabilities: { addressContext: "user-controlled" },
  });

  return kit.estimate({
    from: { adapter, chain: toBridgeChainIdentifier(params.sourceChainId) },
    to: { adapter, chain: toBridgeChainIdentifier(params.destinationChainId) },
    amount: params.amount,
    token: "USDC",
  });
}

export async function executeBridgeUsdc(params: {
  walletClient: WalletClient;
  sourceChainId: BridgeChainId;
  destinationChainId: BridgeChainId;
  amount: string;
  onStageChange?: (stage: string) => void;
  onManualChainSwitchRequired?: ManualChainSwitchHandler;
}): Promise<BridgeResult> {
  const [{ BridgeKit }, { createViemAdapterFromProvider }] = await Promise.all([
    import("@circle-fin/bridge-kit"),
    import("@circle-fin/adapter-viem-v2"),
  ]);

  const kit = new BridgeKit();
  const adapter = await createViemAdapterFromProvider({
    provider: walletClientToEip1193Provider(
      params.walletClient,
      params.onManualChainSwitchRequired
    ),
    capabilities: { addressContext: "user-controlled" },
  });

  const onAnyStep = (event: { method?: string }) => {
    if (!event?.method) return;
    params.onStageChange?.(formatBridgeStage(event.method));
  };

  kit.on("*", onAnyStep as never);
  try {
    params.onStageChange?.("Preparing bridge transaction...");
    return await kit.bridge({
      from: { adapter, chain: toBridgeChainIdentifier(params.sourceChainId) },
      to: { adapter, chain: toBridgeChainIdentifier(params.destinationChainId) },
      amount: params.amount,
      token: "USDC",
    });
  } finally {
    kit.off("*", onAnyStep as never);
  }
}

export async function formatBridgeError(error: unknown): Promise<string> {
  const { getErrorMessage } = await import("@circle-fin/bridge-kit");
  return getErrorMessage(error);
}
