"use client";

import { useState } from "react";
import { useChainId } from "wagmi";
import { useChainTheme, CHAIN_ACCENT } from "@/lib/theme";

type PaymentFormProps = {
  billId: string;
  amountWei: bigint;
  amountFormatted: string;
  onPayNormal: () => Promise<void>;
  onPayConfidential?: () => Promise<void>;
  isPayer: boolean;
  alreadyPaid: boolean;
  paymentStatus?: string | null;
};

export function PaymentForm({
  amountFormatted,
  onPayNormal,
  onPayConfidential,
  isPayer,
  alreadyPaid,
  paymentStatus,
}: PaymentFormProps) {
  const chainId = useChainId();
  const theme = useChainTheme();
  const accent = CHAIN_ACCENT[theme];
  const [mode, setMode] = useState<"normal" | "confidential">("normal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isPayer) {
    return (
      <p className="text-sm text-stone-500">
        You are not a participant in this split.
      </p>
    );
  }

  if (alreadyPaid) {
    return (
      <p className={`text-sm font-medium ${accent.text}`}>
        You have already paid.
      </p>
    );
  }

  const handlePay = async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === "normal") {
        await onPayNormal();
      } else if (onPayConfidential) {
        await onPayConfidential();
      } else {
        setError("Confidential payments are not yet implemented.");
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-white/70 bg-white/85 p-6 backdrop-blur">
      <h3 className="text-lg font-semibold text-stone-900">Pay your share</h3>
      <div className="mt-4 flex gap-6">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="mode"
            checked={mode === "normal"}
            onChange={() => setMode("normal")}
            className="h-4 w-4"
          />
          <span className="text-sm">Normal</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="mode"
            checked={mode === "confidential"}
            onChange={() => setMode("confidential")}
            className="h-4 w-4"
          />
          <span className="text-sm">Confidential</span>
        </label>
      </div>
      {mode === "normal" && (
        <p className="mt-2 text-sm text-stone-600">{amountFormatted}</p>
      )}
      {mode === "confidential" && (
        <p className="mt-2 text-sm text-stone-600">
          Confidential payment uses your cUSDC balance. If needed, top up cUSDC in
          Confidential Wallet first.
        </p>
      )}
      {mode === "confidential" && !chainId && (
        <p className="mt-2 text-sm text-amber-700">
          Connect your wallet to use confidential mode.
        </p>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
      {paymentStatus && !error && (
        <p className="mt-2 text-sm text-stone-600">{paymentStatus}</p>
      )}
      <button
        onClick={handlePay}
        disabled={loading}
        className={`mt-5 rounded-2xl px-6 py-3 text-sm font-semibold text-white ${accent.bg} ${accent.hover} transition disabled:opacity-50`}
      >
        {loading ? "Processing…" : "Pay"}
      </button>
    </div>
  );
}
