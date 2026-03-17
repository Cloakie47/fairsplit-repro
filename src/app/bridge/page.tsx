"use client";

import { useState, useCallback } from "react";
import { useAccount, useWalletClient, useSwitchChain } from "wagmi";

import { LayoutShell } from "@/components/LayoutShell";
import { TransactionModal } from "@/components/TransactionModal";
import {
  BridgeSelector,
  getChainIdFromName,
} from "@/components/bridge/ChainSelector";

import { useChainBalance } from "@/lib/queries";
import {
  isBridgeChainId,
  getBridgeChainLabel,
  executeBridgeUsdc,
  formatBridgeError,
  type BridgeChainId,
} from "@/lib/bridge";
import { logActivity } from "@/lib/activity";
import { showSuccessToast, showErrorToast } from "@/lib/toast";

function shortenError(msg: string): string {
  if (/reject|cancel|denied|user\s*rejected/i.test(msg)) {
    return "Transaction was cancelled.";
  }
  const beforeDetails = msg.split("Request Arguments:")[0]?.split("Details:")[0]?.trim() ?? msg;
  return beforeDetails.length > 80 ? beforeDetails.slice(0, 77) + "..." : beforeDetails;
}

export default function BridgePage() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();

  const [fromChain, setFromChain] = useState("Base Sepolia");
  const [toChain, setToChain] = useState("Arc Testnet");

  const sourceChainId = getChainIdFromName(fromChain) ?? 84532;
  const destChainId = getChainIdFromName(toChain) ?? 5042002;

  const { data: sourceBalances, refetch: refetchSource } = useChainBalance(
    sourceChainId,
    { refetchIntervalMs: 5_000 }
  );
  const { data: destBalances, refetch: refetchDest } = useChainBalance(
    destChainId,
    { refetchIntervalMs: 5_000 }
  );

  const sourceBalance = sourceBalances?.[0];
  const destBalance = destBalances?.[0];
  const srcFormatted = sourceBalance
    ? `${parseFloat(sourceBalance.formatted).toFixed(2)} USDC`
    : "— USDC";
  const dstFormatted = destBalance
    ? `${parseFloat(destBalance.formatted).toFixed(2)} USDC`
    : "— USDC";

  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<string | null>(null);

  const handleFromToChange = useCallback(
    (from: string, to: string) => {
      setFromChain(from);
      setToChain(to);
    },
    []
  );

  const handleBridge = async (params: {
    fromChain: string;
    toChain: string;
    amount: string;
  }) => {
    if (!walletClient || !params.amount) return;

    const srcId = getChainIdFromName(params.fromChain);
    const dstId = getChainIdFromName(params.toChain);

    if (
      srcId === null ||
      dstId === null ||
      !isBridgeChainId(srcId) ||
      !isBridgeChainId(dstId)
    ) {
      showErrorToast(
        "Bridge failed",
        "Bridge only supports Base Sepolia and Arc Testnet."
      );
      return;
    }

    setLoading(true);
    setStage("Preparing bridge...");
    try {
      const result = await executeBridgeUsdc({
        walletClient,
        sourceChainId: srcId as BridgeChainId,
        destinationChainId: dstId as BridgeChainId,
        amount: params.amount,
        onStageChange: setStage,
        onManualChainSwitchRequired: async (targetChainId) => {
          await switchChainAsync({ chainId: targetChainId });
        },
      });

      if (result.state === "success" && address) {
        logActivity(
          address,
          "usdc_bridged",
          `Bridged ${params.amount} USDC`,
          `${getBridgeChainLabel(srcId)} → ${getBridgeChainLabel(dstId)}`,
          { chainId: srcId }
        );
        showSuccessToast(
          "Bridge complete",
          `${params.amount} USDC bridged successfully`
        );
        await Promise.all([refetchSource(), refetchDest()]);
      } else {
        const errorMsg =
          result.steps?.find((s) => s.state === "error")?.errorMessage ??
          "Bridge was cancelled or failed.";
        const isUserCancel =
          /reject|cancel|denied|user\s*rejected/i.test(errorMsg);
        showErrorToast(
          "Bridge cancelled",
          isUserCancel ? "Transaction was cancelled." : shortenError(errorMsg)
        );
      }
    } catch (e) {
      const msg = await formatBridgeError(e);
      const isUserCancel = /reject|cancel|denied|user\s*rejected/i.test(msg);
      showErrorToast(
        "Bridge cancelled",
        isUserCancel ? "Transaction was cancelled." : shortenError(msg)
      );
    } finally {
      setStage(null);
      setLoading(false);
    }
  };

  return (
    <LayoutShell>
      <TransactionModal open={loading} stage={stage} />

      <p className="label-text text-brand-red">■ FairSplit / Bridge</p>
      <h1 className="mt-2 font-grotesk text-page-title font-bold uppercase text-brand-black underline decoration-brand-red decoration-4 underline-offset-4">
        Bridge
      </h1>
      <p className="mt-2 text-body text-brand-ink">
        Bridge USDC between Base Sepolia and Arc Testnet via Circle CCTP.
      </p>

      <div className="mt-8 max-w-2xl">
        <BridgeSelector
          sourceBalance={srcFormatted}
          destBalance={dstFormatted}
          onFromToChange={handleFromToChange}
          onBridge={handleBridge}
          bridgeLoading={loading}
        />
      </div>
    </LayoutShell>
  );
}
