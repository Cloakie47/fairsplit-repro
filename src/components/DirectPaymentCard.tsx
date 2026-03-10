"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useWalletClient } from "wagmi";
import { ethers } from "ethers";
import { useChainTheme, CHAIN_ACCENT } from "@/lib/theme";
import {
  getDefaultTokenForChain,
  getTokensForChain,
  SUPPORTED_CHAINS,
} from "@/lib/chains";
import { transferUsdc } from "@/lib/usdc";
import {
  isConfidentialTransferConfigured,
  performConfidentialPayment,
  preflightConfidentialPayment,
} from "@/lib/stabletrust";
import { logActivity } from "@/lib/activity";
import { walletClientToSigner } from "@/lib/wallet";
import { showSuccessToast } from "@/lib/toast";
import { resolveInputToAddress } from "@/lib/nameService";

export function DirectPaymentCard() {
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const theme = useChainTheme();
  const accent = CHAIN_ACCENT[theme];
  const isTempo = chainId === SUPPORTED_CHAINS.tempoTestnet.id;
  const availableTokens = useMemo(() => getTokensForChain(chainId), [chainId]);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"normal" | "confidential">("normal");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [selectedTokenAddress, setSelectedTokenAddress] = useState("");
  const selectedToken =
    availableTokens.find((token) => token.address === selectedTokenAddress) ??
    getDefaultTokenForChain(chainId);
  const tokenSymbol = selectedToken?.symbol ?? "USDC";
  const confidentialTokenSymbol = selectedToken?.confidentialSymbol ?? `c${tokenSymbol}`;
  const tokenDecimals = selectedToken?.decimals ?? 6;
  const confidentialConfigured = isConfidentialTransferConfigured(chainId);
  const confidentialModeDisabled = mode === "confidential" && !confidentialConfigured;

  useEffect(() => {
    const fallback = getDefaultTokenForChain(chainId);
    if (!fallback) {
      setSelectedTokenAddress("");
      return;
    }
    const exists = availableTokens.some((token) => token.address === selectedTokenAddress);
    if (!selectedTokenAddress || !exists) {
      setSelectedTokenAddress(fallback.address);
    }
  }, [availableTokens, chainId, selectedTokenAddress]);

  const onPay = async () => {
    if (!isConnected || !chainId || !walletClient || !selectedToken) return;
    setLoading(true);
    setMessage(null);
    setStage(null);
    try {
      const tokenAddress = selectedToken.address;
      if (!tokenAddress) {
        throw new Error(
          isTempo
            ? "Tempo direct payments are being upgraded for multi-token support. Switch to Base or Arc for now."
            : "Unsupported chain. Switch to Base or Arc."
        );
      }
      const recipientInput = recipient.trim();
      if (!recipientInput) throw new Error("Recipient is required.");
      if (mode === "confidential" && !confidentialConfigured) {
        throw new Error(
          isTempo
            ? `Tempo confidential ${tokenSymbol} transfers need NEXT_PUBLIC_TEMPO_STABLETRUST_ADDRESS before they can be used.`
            : `Confidential ${tokenSymbol} transfers are not configured for this chain.`
        );
      }
      setStage("Resolving recipient name...");
      const resolvedRecipient = await resolveInputToAddress(recipientInput, chainId);
      const amountRaw = ethers.parseUnits(amount || "0", tokenDecimals);
      if (amountRaw <= BigInt(0)) throw new Error("Enter a valid amount.");
      const recipientLabel =
        recipientInput.toLowerCase() === resolvedRecipient.toLowerCase()
          ? resolvedRecipient
          : `${recipientInput} -> ${resolvedRecipient}`;

      const signer = await walletClientToSigner(walletClient);

      if (mode === "normal") {
        setStage("Sending normal payment...");
        const txHash = await transferUsdc(tokenAddress, resolvedRecipient, amountRaw, signer);
        logActivity(
          "direct_paid_normal",
          "Direct payment sent",
          `${ethers.formatUnits(amountRaw, tokenDecimals)} ${tokenSymbol} to ${recipientLabel}`,
          { chainId, txHash }
        );
        showSuccessToast("Payment successful", `Direct ${tokenSymbol} transfer confirmed`);
        setMessage(`Direct ${tokenSymbol} payment sent.`);
      } else {
        setStage("Running confidential preflight checks...");
        await preflightConfidentialPayment(
          signer,
          resolvedRecipient,
          tokenAddress,
          amountRaw,
          chainId
        );
        setStage("Preflight complete. Opening wallet...");
        const txHash = await performConfidentialPayment(
          signer,
          resolvedRecipient,
          tokenAddress,
          amountRaw,
          chainId,
          (next) => {
            const labels: Record<string, string> = {
              awaiting_signature: "Waiting for wallet signature...",
              creating_account: "Initializing confidential account...",
              checking_recipient: "Checking recipient confidential account...",
              depositing: `Depositing to ${confidentialTokenSymbol} balance...`,
              transferring: "Submitting confidential transfer...",
              finalizing: "Waiting for finalization...",
              retrying: "Network is temporarily busy, retrying...",
            };
            setStage(labels[next] ?? "Processing confidential transfer...");
          }
        );
        logActivity(
          "direct_paid_confidential",
          "Confidential direct payment submitted",
          `${ethers.formatUnits(amountRaw, tokenDecimals)} ${tokenSymbol} (confidential) to ${recipientLabel}`,
          { chainId, txHash }
        );
        showSuccessToast("Payment successful", "Confidential transfer submitted");
        setMessage("Confidential payment submitted.");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Payment failed.");
    } finally {
      setStage(null);
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white/95 p-5">
      <h3 className="text-lg font-semibold text-stone-900">Direct payment</h3>
      <p className="mt-1 text-sm text-stone-600">
        Send your selected stable token directly. Confidential mode spends {confidentialTokenSymbol};
        top up {confidentialTokenSymbol} in Confidential Wallet first.
      </p>
      {isTempo && (
        confidentialConfigured ? (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Tempo normal and confidential direct payments are enabled for the selected token.
          </p>
        ) : (
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Tempo normal token transfers are enabled here. Add the Tempo StableTrust config to unlock
            confidential direct payments.
          </p>
        )
      )}

      <div className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700">Token</label>
          {availableTokens.length > 1 ? (
            <select
              value={selectedTokenAddress}
              onChange={(e) => setSelectedTokenAddress(e.target.value)}
              className={`mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 ${accent.focus}`}
            >
              {availableTokens.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
            </select>
          ) : (
            <div className="mt-2 inline-flex rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm font-semibold text-stone-700">
              {selectedToken?.symbol}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700">Recipient wallet</label>
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x... or alice.base or vitalik.eth"
            className={`mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 ${accent.focus}`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700">Amount ({tokenSymbol})</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="10.00"
            className={`mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 ${accent.focus}`}
          />
        </div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="radio"
              checked={mode === "normal"}
              onChange={() => setMode("normal")}
            />
            Normal
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="radio"
              checked={mode === "confidential"}
              onChange={() => setMode("confidential")}
            />
            Confidential
          </label>
        </div>
        <button
          type="button"
          onClick={onPay}
          disabled={!isConnected || !walletClient || loading || confidentialModeDisabled}
          className="rounded-xl border border-[#d56ac7] bg-[#f7b8ee] px-5 py-2.5 text-sm font-semibold text-stone-900 transition hover:brightness-95 disabled:opacity-50"
        >
          {confidentialModeDisabled
            ? isTempo
              ? `Configure Tempo confidential ${tokenSymbol}`
              : `Confidential ${tokenSymbol} unavailable`
            : loading
            ? "Processing..."
            : "Pay now"}
        </button>
        {stage && <p className="text-sm text-stone-600">{stage}</p>}
        {message && <p className="text-sm text-stone-600">{message}</p>}
      </div>
    </div>
  );
}

