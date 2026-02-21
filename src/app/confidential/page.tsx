"use client";

import { useState } from "react";
import { useAccount, useChainId, useWalletClient } from "wagmi";
import Link from "next/link";
import { LayoutShell } from "@/components/LayoutShell";
import { USDC_ADDRESSES, SUPPORTED_CHAINS } from "@/lib/chains";
import {
  depositUsdcToConfidential,
  ensureConfidentialAccount,
  getSignerAddress,
  getConfidentialBalanceSummary,
  hasStoredConfidentialKeys,
  preflightConfidentialTopUp,
  preflightConfidentialWithdraw,
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
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [balance, setBalance] = useState<{
    total: number;
    available: number;
    pending: number;
  } | null>(null);

  const isSupportedChain =
    chainId === SUPPORTED_CHAINS.arcTestnet.id || chainId === SUPPORTED_CHAINS.baseSepolia.id;
  const canUseConfidential = !!isConnected && !!walletClient && !!chainId && isSupportedChain;
  const availableAmount = balance?.available ?? 0;
  const withdrawAsNumber = Number(withdrawAmount || "0");
  const withdrawDisabled =
    !canUseConfidential ||
    loading ||
    !Number.isFinite(withdrawAsNumber) ||
    withdrawAsNumber <= 0 ||
    withdrawAsNumber > availableAmount;
  const depositAsNumber = Number(depositAmount || "0");
  const depositDisabled =
    !canUseConfidential ||
    loading ||
    !Number.isFinite(depositAsNumber) ||
    depositAsNumber <= 0;

  const statusLabels: Record<string, string> = {
    awaiting_signature: "Waiting for wallet signature...",
    creating_account: "Creating confidential account...",
    reading_balance: "Refreshing confidential balance...",
    depositing: "Converting USDC to cUSDC...",
    withdrawing: "Converting cUSDC to USDC...",
    transferring: "Submitting confidential transfer...",
    finalizing: "Waiting for finalization...",
    retrying: "Network is temporarily busy, retrying...",
  };

  const setupAccount = async () => {
    if (!walletClient || !chainId) return;
    setLoading(true);
    setStatus(null);
    setStage(null);
    try {
      const signer = await walletClientToSigner(walletClient);
      await ensureConfidentialAccount(signer, chainId, (next) => {
        setStage(statusLabels[next] ?? "Initializing account...");
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
      setStage("Running withdraw preflight checks...");
      await preflightConfidentialWithdraw(signer, usdc, withdrawAmount, chainId);
      setStage("Preflight complete. Opening wallet...");
      await withdrawConfidentialToUsdc(signer, usdc, withdrawAmount, chainId, (next) => {
        setStage(statusLabels[next] ?? "Submitting withdraw transaction...");
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

  const topUpConfidential = async () => {
    if (!walletClient || !chainId) return;
    setLoading(true);
    setStatus(null);
    setStage(null);
    try {
      const usdc = USDC_ADDRESSES[chainId];
      if (!usdc) throw new Error("Unsupported chain.");
      const signer = await walletClientToSigner(walletClient);
      setStage("Running top-up preflight checks...");
      await preflightConfidentialTopUp(signer, usdc, depositAmount, chainId);
      setStage("Preflight complete. Opening wallet...");
      await depositUsdcToConfidential(signer, usdc, depositAmount, chainId, (next) => {
        setStage(statusLabels[next] ?? "Converting USDC to cUSDC...");
      });
      setStatus("USDC converted to cUSDC.");
      setDepositAmount("");
      await refreshBalance();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Conversion failed.");
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
            Use this page to initialize your confidential account, convert USDC to cUSDC,
            view confidential balances, and convert cUSDC back to USDC.
          </p>
          {!isSupportedChain && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Confidential flow is enabled on Base Sepolia and Arc testnet.
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
                {balance ? balance.total.toFixed(2) : "--"} cUSDC
              </p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-4">
              <p className="text-xs text-stone-500">Available cUSDC</p>
              <p className="text-xl font-semibold text-stone-900">
                {balance ? balance.available.toFixed(2) : "--"} cUSDC
              </p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-4">
              <p className="text-xs text-stone-500">Pending cUSDC</p>
              <p className="text-xl font-semibold text-stone-900">
                {balance ? balance.pending.toFixed(2) : "--"} cUSDC
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl backdrop-blur">
          <h2 className="text-lg font-semibold text-stone-900">Convert USDC to cUSDC</h2>
          <p className="mt-1 text-sm text-stone-600">
            Tops up your confidential balance from your public wallet balance.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="10.00"
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
            <button
              onClick={topUpConfidential}
              disabled={depositDisabled}
              className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-800 disabled:opacity-50"
            >
              Convert to cUSDC
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl backdrop-blur">
          <h2 className="text-lg font-semibold text-stone-900">Convert cUSDC to USDC</h2>
          <p className="mt-1 text-sm text-stone-600">
            Moves confidential available balance into your normal wallet USDC balance.
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
            This conversion is enabled only when account is initialized and amount is within available cUSDC.
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

