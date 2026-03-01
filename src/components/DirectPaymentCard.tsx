"use client";

import { useState } from "react";
import { useAccount, useChainId, useWalletClient } from "wagmi";
import { ethers } from "ethers";
import { useChainTheme, CHAIN_ACCENT } from "@/lib/theme";
import { USDC_ADDRESSES } from "@/lib/chains";
import { transferUsdc } from "@/lib/usdc";
import {
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
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"normal" | "confidential">("normal");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);

  const onPay = async () => {
    if (!isConnected || !chainId || !walletClient) return;
    setLoading(true);
    setMessage(null);
    setStage(null);
    try {
      const usdc = USDC_ADDRESSES[chainId];
      if (!usdc) throw new Error("Unsupported chain. Switch to Base or Arc.");
      const recipientInput = recipient.trim();
      if (!recipientInput) throw new Error("Recipient is required.");
      setStage("Resolving recipient name...");
      const resolvedRecipient = await resolveInputToAddress(recipientInput, chainId);
      const amountRaw = ethers.parseUnits(amount || "0", 6);
      if (amountRaw <= BigInt(0)) throw new Error("Enter a valid amount.");
      const recipientLabel =
        recipientInput.toLowerCase() === resolvedRecipient.toLowerCase()
          ? resolvedRecipient
          : `${recipientInput} -> ${resolvedRecipient}`;

      const signer = await walletClientToSigner(walletClient);

      if (mode === "normal") {
        setStage("Sending normal payment...");
        const txHash = await transferUsdc(usdc, resolvedRecipient, amountRaw, signer);
        logActivity(
          "direct_paid_normal",
          "Direct payment sent",
          `${ethers.formatUnits(amountRaw, 6)} USDC to ${recipientLabel}`,
          { chainId, txHash }
        );
        showSuccessToast("Payment successful", "Direct USDC transfer confirmed");
        setMessage("Direct payment sent.");
      } else {
        setStage("Running confidential preflight checks...");
        await preflightConfidentialPayment(
          signer,
          resolvedRecipient,
          usdc,
          amountRaw,
          chainId
        );
        setStage("Preflight complete. Opening wallet...");
        const txHash = await performConfidentialPayment(
          signer,
          resolvedRecipient,
          usdc,
          amountRaw,
          chainId,
          (next) => {
            const labels: Record<string, string> = {
              awaiting_signature: "Waiting for wallet signature...",
              creating_account: "Initializing confidential account...",
              checking_recipient: "Checking recipient confidential account...",
              depositing: "Depositing to confidential balance...",
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
          `${ethers.formatUnits(amountRaw, 6)} USDC (confidential) to ${recipientLabel}`,
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
        Send USDC directly. Confidential mode spends cUSDC; top up cUSDC in Confidential Wallet first.
      </p>

      <div className="mt-4 space-y-4">
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
          <label className="block text-sm font-medium text-stone-700">Amount (USDC)</label>
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
          disabled={!isConnected || !walletClient || loading}
          className="rounded-xl border border-[#d56ac7] bg-[#f7b8ee] px-5 py-2.5 text-sm font-semibold text-stone-900 transition hover:brightness-95 disabled:opacity-50"
        >
          {loading ? "Processing..." : "Pay now"}
        </button>
        {stage && <p className="text-sm text-stone-600">{stage}</p>}
        {message && <p className="text-sm text-stone-600">{message}</p>}
      </div>
    </div>
  );
}

