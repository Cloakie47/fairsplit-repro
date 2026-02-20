"use client";

import { useState } from "react";
import { useAccount, useChainId, useWalletClient } from "wagmi";
import Link from "next/link";
import { LayoutShell } from "@/components/LayoutShell";
import { USDC_ADDRESSES, SUPPORTED_CHAINS } from "@/lib/chains";
import {
  ensureConfidentialAccount,
  getSignerAddress,
  getConfidentialBalanceSummary,
  hasStoredConfidentialKeys,
  withdrawConfidentialToUsdc,
} from "@/lib/stabletrust";
import { logActivity } from "@/lib/activity";
import { walletClientToSigner } from "@/lib/wallet";

export default function ConfidentialPage() {
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const [status, setStatus] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [balance, setBalance] = useState<{
    total: number;
    available: number;
    pending: number;
  } | null>(null);

  const isArc = chainId === SUPPORTED_CHAINS.arcTestnet.id;
  const canUseConfidential = !!isConnected && !!walletClient && !!chainId && isArc;
  const availableAmount = balance?.available ?? 0;
  const withdrawAsNumber = Number(withdrawAmount || "0");
  const withdrawDisabled =
    !canUseConfidential ||
    loading ||
    !Number.isFinite(withdrawAsNumber) ||
    withdrawAsNumber <= 0 ||
    withdrawAsNumber > availableAmount;

  const setupAccount = async () => {
    if (!walletClient || !chainId) return;
    setLoading(true);
    setStatus(null);
    setStage(null);
    try {
      const signer = await walletClientToSigner(walletClient);
      await ensureConfidentialAccount(signer, chainId, (next) => {
        const labels: Record<string, string> = {
          awaiting_signature: "Waiting for wallet signature...",
          creating_account: "Creating confidential account...",
          finalizing: "Waiting for finalization...",
        };
        setStage(labels[next] ?? "Initializing account...");
      });
      logActivity(
        "confidential_account_initialized",
        "Confidential account initialized"
      );
      setStatus("Confidential account initialized.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to initialize account.");
    } finally {
      setStage(null);
      setLoading(false);
    }
  };

  const refreshBalance = async () => {
    if (!walletClient || !chainId) return;
    setLoading(true);
    setStatus(null);
    setStage(null);
    try {
      const usdc = USDC_ADDRESSES[chainId];
      if (!usdc) throw new Error("Unsupported chain.");
      const signer = await walletClientToSigner(walletClient);
      const signerAddress = await getSignerAddress(signer);
      if (!hasStoredConfidentialKeys(chainId, signerAddress)) {
        throw new Error("Initialize confidential account first.");
      }
      const next = await getConfidentialBalanceSummary(signer, usdc, chainId, () => {
        setStage("Refreshing confidential balance...");
      });
      setBalance(next);
      logActivity(
        "confidential_balance_refreshed",
        "Confidential balance refreshed",
        `Available ${next.available.toFixed(2)} USDC`
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to fetch balance.");
    } finally {
      setStage(null);
      setLoading(false);
    }
  };

  const withdraw = async () => {
    if (!walletClient || !chainId) return;
    setLoading(true);
    setStatus(null);
    setStage(null);
    try {
      const usdc = USDC_ADDRESSES[chainId];
      if (!usdc) throw new Error("Unsupported chain.");
      if (withdrawAsNumber > availableAmount) {
        throw new Error("Withdraw amount is greater than available confidential balance.");
      }
      const signer = await walletClientToSigner(walletClient);
      await withdrawConfidentialToUsdc(signer, usdc, withdrawAmount, chainId, () => {
        setStage("Submitting withdraw transaction...");
      });
      logActivity(
        "confidential_withdraw_completed",
        "Confidential withdraw completed",
        `${withdrawAmount} USDC to public wallet`
      );
      setStatus("Withdraw completed.");
      setWithdrawAmount("");
      await refreshBalance();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Withdraw failed.");
    } finally {
      setStage(null);
      setLoading(false);
    }
  };

  return (
    <LayoutShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
          Confidential Wallet
        </h1>
        <Link
          href="/"
          className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800"
        >
          Back home
        </Link>
      </div>

      <div className="space-y-5">
        <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl backdrop-blur">
          <p className="text-sm text-stone-600">
            Use this page to initialize your confidential account, view confidential balances,
            and withdraw to public USDC.
          </p>
          {!isArc && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Confidential flow is currently enabled for Arc testnet.
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl backdrop-blur">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={setupAccount}
              disabled={!canUseConfidential || loading}
              className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-800 disabled:opacity-50"
            >
              Initialize account
            </button>
            <button
              onClick={refreshBalance}
              disabled={!canUseConfidential || loading}
              className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-800 disabled:opacity-50"
            >
              Refresh balance
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-stone-200 bg-white p-4">
              <p className="text-xs text-stone-500">Total</p>
              <p className="text-xl font-semibold text-stone-900">
                {balance ? balance.total.toFixed(2) : "--"} USDC
              </p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-4">
              <p className="text-xs text-stone-500">Available</p>
              <p className="text-xl font-semibold text-stone-900">
                {balance ? balance.available.toFixed(2) : "--"} USDC
              </p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-4">
              <p className="text-xs text-stone-500">Pending</p>
              <p className="text-xl font-semibold text-stone-900">
                {balance ? balance.pending.toFixed(2) : "--"} USDC
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl backdrop-blur">
          <h2 className="text-lg font-semibold text-stone-900">Withdraw to public USDC</h2>
          <p className="mt-1 text-sm text-stone-600">
            Moves confidential available balance into your normal Arc USDC wallet balance.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="10.00"
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
            <button
              onClick={withdraw}
              disabled={withdrawDisabled}
              className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-800 disabled:opacity-50"
            >
              Withdraw
            </button>
          </div>
          <p className="mt-2 text-xs text-stone-500">
            Withdraw is enabled only when account is initialized and amount is within available balance.
          </p>
        </div>

        {stage && (
          <p className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 shadow-sm">
            {stage}
          </p>
        )}
        {status && (
          <p className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 shadow-sm">
            {status}
          </p>
        )}
      </div>
    </LayoutShell>
  );
}

