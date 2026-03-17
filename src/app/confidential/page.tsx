"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useWalletClient } from "wagmi";

import { LayoutShell } from "@/components/LayoutShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { StatStrip } from "@/components/ui/StatStrip";
import { TransactionModal } from "@/components/TransactionModal";

import {
  getDefaultTokenForChain,
  getTokensForChain,
  SUPPORTED_CHAINS,
} from "@/lib/chains";
import { walletClientToSigner } from "@/lib/wallet";
import {
  isConfidentialTransferConfigured,
  ensureConfidentialAccount,
  getConfidentialBalanceSummary,
  depositUsdcToConfidential,
  withdrawConfidentialToUsdc,
  claimPendingConfidentialBalance,
} from "@/lib/stabletrust";
import { logActivity } from "@/lib/activity";
import { showSuccessToast } from "@/lib/toast";

export default function ConfidentialPage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  const availableTokens = useMemo(() => getTokensForChain(chainId), [chainId]);
  const [selectedTokenAddress, setSelectedTokenAddress] = useState("");
  const selectedToken =
    availableTokens.find((t) => t.address === selectedTokenAddress) ??
    getDefaultTokenForChain(chainId);
  const tokenSymbol = selectedToken?.symbol ?? "USDC";
  const cSymbol = selectedToken?.confidentialSymbol ?? `c${tokenSymbol}`;

  const [topUpAmount, setTopUpAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [balanceSummary, setBalanceSummary] = useState<{
    total: number;
    available: number;
    pending: number;
  } | null>(null);

  const confidentialConfigured = isConfidentialTransferConfigured(chainId);

  useEffect(() => {
    const fallback = getDefaultTokenForChain(chainId);
    if (!fallback) {
      setSelectedTokenAddress("");
      return;
    }
    const exists = availableTokens.some((t) => t.address === selectedTokenAddress);
    if (!selectedTokenAddress || !exists) {
      setSelectedTokenAddress(fallback.address);
    }
  }, [availableTokens, chainId, selectedTokenAddress]);

  const refreshBalance = async () => {
    if (!walletClient || !selectedToken) return;
    try {
      const signer = await walletClientToSigner(walletClient);
      const summary = await getConfidentialBalanceSummary(
        signer,
        selectedToken.address,
        chainId,
        setStage
      );
      setBalanceSummary(summary);
      setStage(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh balance.");
      setStage(null);
    }
  };

  const onInitialize = async () => {
    if (!walletClient) return;
    setLoading(true);
    setError(null);
    setStage("Initializing confidential account...");
    try {
      const signer = await walletClientToSigner(walletClient);
      await ensureConfidentialAccount(signer, chainId, setStage);
      address && logActivity(address, "confidential_account_initialized", "Confidential account initialized", undefined, { chainId });
      showSuccessToast("Account ready", "Confidential account initialized");
      await refreshBalance();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Initialization failed.");
    } finally {
      setStage(null);
      setLoading(false);
    }
  };

  const onTopUp = async () => {
    if (!walletClient || !selectedToken || !topUpAmount) return;
    setLoading(true);
    setError(null);
    try {
      const signer = await walletClientToSigner(walletClient);
      await depositUsdcToConfidential(signer, selectedToken.address, topUpAmount, chainId, setStage);
      address && logActivity(address, "confidential_topup_completed", `Deposited ${topUpAmount} ${tokenSymbol}`, undefined, { chainId });
      showSuccessToast("Top-up complete", `${topUpAmount} ${tokenSymbol} → ${cSymbol}`);
      setTopUpAmount("");
      await refreshBalance();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Top-up failed.");
    } finally {
      setStage(null);
      setLoading(false);
    }
  };

  const onWithdraw = async () => {
    if (!walletClient || !selectedToken || !withdrawAmount) return;
    setLoading(true);
    setError(null);
    try {
      const signer = await walletClientToSigner(walletClient);
      await withdrawConfidentialToUsdc(signer, selectedToken.address, withdrawAmount, chainId, setStage);
      address && logActivity(address, "confidential_withdraw_completed", `Withdrew ${withdrawAmount} ${cSymbol}`, undefined, { chainId });
      showSuccessToast("Withdraw complete", `${withdrawAmount} ${cSymbol} → ${tokenSymbol}`);
      setWithdrawAmount("");
      await refreshBalance();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Withdraw failed.");
    } finally {
      setStage(null);
      setLoading(false);
    }
  };

  const onClaim = async () => {
    if (!walletClient || !selectedToken) return;
    setLoading(true);
    setError(null);
    try {
      const signer = await walletClientToSigner(walletClient);
      await claimPendingConfidentialBalance(signer, selectedToken.address, chainId, setStage);
      address && logActivity(address, "confidential_claim_completed", "Claimed pending balance", undefined, { chainId });
      showSuccessToast("Claim complete", "Pending balance claimed");
      await refreshBalance();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Claim failed.");
    } finally {
      setStage(null);
      setLoading(false);
    }
  };

  return (
    <LayoutShell>
      <TransactionModal open={loading} stage={stage} />

      <p className="label-text text-brand-red">■ FairSplit / Confidential Wallet</p>
      <h1 className="mt-2 font-grotesk text-page-title font-bold uppercase text-brand-black underline decoration-brand-red decoration-4 underline-offset-4">
        Confidential Wallet
      </h1>
      <p className="mt-2 text-body text-brand-ink">
        Manage your confidential token balance. Top up, withdraw, or claim pending transfers.
      </p>

      {!confidentialConfigured && (
        <Card className="mt-6 p-4">
          <p className="font-mono text-sm text-brand-muted">
            Confidential transfers are not configured for this chain. Switch to Base or Arc.
          </p>
        </Card>
      )}

      {confidentialConfigured && (
        <>
          {availableTokens.length > 1 && (
            <div className="mt-6 max-w-xs">
              <span className="label-text text-brand-muted">Token</span>
              <select
                value={selectedTokenAddress}
                onChange={(e) => setSelectedTokenAddress(e.target.value)}
                className="mt-1 w-full border-2 border-brand-black bg-brand-bg px-4 py-3 font-mono text-body focus:bg-brand-yellow focus:shadow-brutal focus:outline-none"
              >
                {availableTokens.map((t) => (
                  <option key={t.address} value={t.address}>{t.symbol}</option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-6">
            <StatStrip
              items={[
                { label: `${cSymbol} Total`, value: `$${balanceSummary ? balanceSummary.total.toFixed(2) : "0.00"}` },
                { label: "Available", value: `$${balanceSummary ? balanceSummary.available.toFixed(2) : "0.00"}` },
                { label: "Pending", value: `$${balanceSummary ? balanceSummary.pending.toFixed(2) : "0.00"}` },
              ]}
            />
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <Card className="p-5">
              <p className="label-text text-brand-green">// Initialize</p>
              <p className="mt-2 text-body text-brand-ink">
                Create or recover your confidential account.
              </p>
              <Button
                variant="black"
                size="md"
                className="mt-4 w-full"
                onClick={onInitialize}
                disabled={loading || !isConnected}
              >
                Initialize
              </Button>
            </Card>

            <Card className="p-5">
              <p className="label-text text-brand-green">// Top Up</p>
              <Input
                label={`Amount (${tokenSymbol})`}
                id="topup-amount"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder="50.00"
              />
              <Button
                variant="yellow"
                size="md"
                className="mt-4 w-full"
                onClick={onTopUp}
                disabled={loading || !isConnected || !topUpAmount}
              >
                Top Up →
              </Button>
            </Card>

            <Card className="p-5">
              <p className="label-text text-brand-red">// Withdraw</p>
              <Input
                label={`Amount (${cSymbol})`}
                id="withdraw-amount"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="25.00"
              />
              <Button
                variant="red"
                size="md"
                className="mt-4 w-full"
                onClick={onWithdraw}
                disabled={loading || !isConnected || !withdrawAmount}
              >
                Withdraw →
              </Button>
            </Card>
          </div>

          <div className="mt-6 flex gap-3">
            <Button variant="white" size="md" onClick={refreshBalance} disabled={loading || !isConnected}>
              Refresh Balance
            </Button>
            <Button
              variant="white"
              size="md"
              onClick={onClaim}
              disabled={loading || !isConnected || !balanceSummary || balanceSummary.pending <= 0}
            >
              Claim Pending
            </Button>
          </div>

          {error && (
            <div className="mt-4 border-2 border-brand-red bg-white p-3 font-mono text-xs text-brand-red">
              {error}
            </div>
          )}
        </>
      )}
    </LayoutShell>
  );
}
