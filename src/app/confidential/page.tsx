"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useWalletClient } from "wagmi";
import Link from "next/link";
import { LayoutShell } from "@/components/LayoutShell";
import {
  getDefaultTokenForChain,
  getTokensForChain,
  SUPPORTED_CHAINS,
} from "@/lib/chains";
import {
  claimPendingConfidentialBalance,
  depositUsdcToConfidential,
  ensureConfidentialAccount,
  getSignerAddress,
  getConfidentialBalanceSummary,
  hasStoredConfidentialKeys,
  isConfidentialTransferConfigured,
  preflightConfidentialTopUp,
  preflightConfidentialWithdraw,
  withdrawConfidentialToUsdc,
} from "@/lib/stabletrust";
import { logActivity } from "@/lib/activity";
import { walletClientToSigner } from "@/lib/wallet";
import { TransactionModal } from "@/components/TransactionModal";
import { showSuccessToast } from "@/lib/toast";

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
  const [selectedTokenAddress, setSelectedTokenAddress] = useState("");
  const isTempo = chainId === SUPPORTED_CHAINS.tempoTestnet.id;
  const availableTokens = useMemo(() => getTokensForChain(chainId), [chainId]);
  const selectedToken =
    availableTokens.find((token) => token.address === selectedTokenAddress) ??
    getDefaultTokenForChain(chainId);
  const tokenSymbol = selectedToken?.symbol ?? "USDC";
  const confidentialTokenSymbol = selectedToken?.confidentialSymbol ?? `c${tokenSymbol}`;
  const confidentialConfigured = isConfidentialTransferConfigured(chainId);

  const isSupportedChain = confidentialConfigured;
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
  const pendingAmount = balance?.pending ?? 0;
  const claimDisabled =
    !canUseConfidential || loading || !Number.isFinite(pendingAmount) || pendingAmount <= 0;

  const statusLabels: Record<string, string> = {
    awaiting_signature: "Waiting for wallet signature...",
    creating_account: "Creating confidential account...",
    reading_balance: "Refreshing confidential balance...",
    depositing: `Converting ${tokenSymbol} to ${confidentialTokenSymbol}...`,
    withdrawing: `Converting ${confidentialTokenSymbol} to ${tokenSymbol}...`,
    transferring: "Submitting confidential transfer...",
    finalizing: "Waiting for finalization...",
    retrying: "Network is temporarily busy, retrying...",
  };

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
        "Confidential account initialized",
        undefined,
        { chainId }
      );
      setStatus("Confidential account initialized.");
      showSuccessToast("Confidential account initialized");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to initialize account.");
    } finally {
      setStage(null);
      setLoading(false);
    }
  };

  const refreshBalance = async () => {
    if (!walletClient || !chainId || !selectedToken) return;
    setLoading(true);
    setStatus(null);
    setStage(null);
    try {
      const tokenAddress = selectedToken.address;
      const signer = await walletClientToSigner(walletClient);
      const signerAddress = await getSignerAddress(signer);
      if (!hasStoredConfidentialKeys(chainId, signerAddress)) {
        throw new Error("Initialize confidential account first.");
      }
      const next = await getConfidentialBalanceSummary(signer, tokenAddress, chainId, () => {
        setStage("Refreshing confidential balance...");
      });
      setBalance(next);
      logActivity(
        "confidential_balance_refreshed",
        "Confidential balance refreshed",
        `Available ${next.available.toFixed(2)} ${tokenSymbol}`,
        { chainId }
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to fetch balance.");
    } finally {
      setStage(null);
      setLoading(false);
    }
  };

  const withdraw = async () => {
    if (!walletClient || !chainId || !selectedToken) return;
    setLoading(true);
    setStatus(null);
    setStage(null);
    try {
      const tokenAddress = selectedToken.address;
      if (withdrawAsNumber > availableAmount) {
        throw new Error("Withdraw amount is greater than available confidential balance.");
      }
      const signer = await walletClientToSigner(walletClient);
      setStage("Running withdraw preflight checks...");
      await preflightConfidentialWithdraw(signer, tokenAddress, withdrawAmount, chainId);
      setStage("Preflight complete. Opening wallet...");
      const txHash = await withdrawConfidentialToUsdc(
        signer,
        tokenAddress,
        withdrawAmount,
        chainId,
        (next) => {
          setStage(statusLabels[next] ?? "Submitting withdraw transaction...");
        }
      );
      logActivity(
        "confidential_withdraw_completed",
        "Confidential withdraw completed",
        `${withdrawAmount} ${tokenSymbol} to public wallet`,
        { chainId, txHash }
      );
      setStatus("Withdraw completed.");
      showSuccessToast("Withdraw completed", `${withdrawAmount} ${tokenSymbol} moved to wallet`);
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
    if (!walletClient || !chainId || !selectedToken) return;
    setLoading(true);
    setStatus(null);
    setStage(null);
    try {
      const tokenAddress = selectedToken.address;
      const signer = await walletClientToSigner(walletClient);
      setStage("Running top-up preflight checks...");
      await preflightConfidentialTopUp(signer, tokenAddress, depositAmount, chainId);
      setStage("Preflight complete. Opening wallet...");
      const txHash = await depositUsdcToConfidential(
        signer,
        tokenAddress,
        depositAmount,
        chainId,
        (next) => {
          setStage(statusLabels[next] ?? `Converting ${tokenSymbol} to ${confidentialTokenSymbol}...`);
        }
      );
      logActivity(
        "confidential_topup_completed",
        `Converted ${tokenSymbol} to ${confidentialTokenSymbol}`,
        `${depositAmount} ${tokenSymbol}`,
        { chainId, txHash }
      );
      setStatus(`${tokenSymbol} converted to ${confidentialTokenSymbol}.`);
      showSuccessToast(`Converted to ${confidentialTokenSymbol}`, `${depositAmount} ${tokenSymbol}`);
      setDepositAmount("");
      await refreshBalance();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Conversion failed.");
    } finally {
      setStage(null);
      setLoading(false);
    }
  };

  const claimPending = async () => {
    if (!walletClient || !chainId || !selectedToken) return;
    setLoading(true);
    setStatus(null);
    setStage(null);
    try {
      const tokenAddress = selectedToken.address;
      const signer = await walletClientToSigner(walletClient);
      setStage(`Claiming pending ${confidentialTokenSymbol}...`);
      const txHash = await claimPendingConfidentialBalance(signer, tokenAddress, chainId, (next) => {
        setStage(statusLabels[next] ?? `Claiming pending ${confidentialTokenSymbol}...`);
      });
      logActivity(
        "confidential_claim_completed",
        `Pending ${confidentialTokenSymbol} claim submitted`,
        "Triggered micro conversion to settle pending balance",
        { chainId, txHash }
      );
      setStatus(`Pending ${confidentialTokenSymbol} claim submitted.`);
      showSuccessToast(`Pending ${confidentialTokenSymbol} claimed`);
      await refreshBalance();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Claim failed.");
    } finally {
      setStage(null);
      setLoading(false);
    }
  };

  return (
    <LayoutShell>
      <TransactionModal open={loading} stage={stage} />
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 md:text-3xl">
          Confidential Wallet
        </h1>
        <Link
          href="/app"
          className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
        >
          Back home
        </Link>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white/95 p-5">
        <p className="text-sm text-stone-600">
          Use this page to initialize your confidential account, convert your selected stable token
          to its confidential balance, view per-token balances, and convert it back to your public wallet.
        </p>
        {!isSupportedChain && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {isTempo
              ? "Tempo confidential wallet is wired for execution, but it still needs NEXT_PUBLIC_TEMPO_STABLETRUST_ADDRESS before the Fairblock route can be used."
              : "Confidential flow is enabled on Base Sepolia and Arc testnet."}
          </p>
        )}

        {availableTokens.length > 1 && (
          <div className="mt-4 rounded-xl border border-stone-200 bg-white p-4">
            <label className="block text-sm font-medium text-stone-700">Selected token</label>
            <select
              value={selectedTokenAddress}
              onChange={(e) => {
                setSelectedTokenAddress(e.target.value);
                setBalance(null);
                setStatus(null);
                setStage(null);
              }}
              className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              {availableTokens.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={setupAccount}
            disabled={!canUseConfidential || loading}
            className="rounded-xl border border-[#d56ac7] bg-[#f7b8ee] px-4 py-2.5 text-sm font-semibold text-stone-900 transition hover:brightness-95 disabled:opacity-50"
          >
            Initialize account
          </button>
          <button
            onClick={refreshBalance}
            disabled={!canUseConfidential || loading}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:bg-stone-100 disabled:opacity-50"
          >
            Refresh balance
          </button>
          <button
            onClick={claimPending}
            disabled={claimDisabled}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:bg-stone-100 disabled:opacity-50"
          >
            Claim pending {confidentialTokenSymbol}
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-stone-200 bg-white p-3.5">
            <p className="text-xs text-stone-500">Total</p>
            <p className="text-xl font-semibold text-stone-900">
              {balance ? balance.total.toFixed(2) : "--"} {confidentialTokenSymbol}
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-3.5">
            <p className="text-xs text-stone-500">Available {confidentialTokenSymbol}</p>
            <p className="text-xl font-semibold text-stone-900">
              {balance ? balance.available.toFixed(2) : "--"} {confidentialTokenSymbol}
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-3.5">
            <p className="text-xs text-stone-500">Pending {confidentialTokenSymbol}</p>
            <p className="text-xl font-semibold text-stone-900">
              {balance ? balance.pending.toFixed(2) : "--"} {confidentialTokenSymbol}
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-stone-200 pt-5">
          <h2 className="text-lg font-semibold text-stone-900">
            Convert {tokenSymbol} to {confidentialTokenSymbol}
          </h2>
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
              className="rounded-xl border border-[#d56ac7] bg-[#f7b8ee] px-4 py-2.5 text-sm font-semibold text-stone-900 transition hover:brightness-95 disabled:opacity-50"
            >
              Convert to {confidentialTokenSymbol}
            </button>
          </div>
        </div>

        <div className="mt-5 border-t border-stone-200 pt-5">
          <h2 className="text-lg font-semibold text-stone-900">
            Convert {confidentialTokenSymbol} to {tokenSymbol}
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Moves confidential available balance into your normal wallet {tokenSymbol} balance.
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
              className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:bg-stone-100 disabled:opacity-50"
            >
              Withdraw
            </button>
          </div>
          <p className="mt-2 text-xs text-stone-500">
            This conversion is enabled only when account is initialized and amount is within available {confidentialTokenSymbol}.
          </p>
        </div>

        {stage && (
          <p className="mt-4 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
            {stage}
          </p>
        )}
        {status && (
          <p className="mt-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
            {status}
          </p>
        )}
      </div>
    </LayoutShell>
  );
}

