"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useWalletClient } from "wagmi";
import { ethers } from "ethers";
import Link from "next/link";

import { LayoutShell } from "@/components/LayoutShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ModeToggle } from "@/components/ui/ModeToggle";
import { Ticker } from "@/components/ui/Ticker";
import { TransactionModal } from "@/components/TransactionModal";

import { useBalances } from "@/lib/queries";
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
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { getUserFriendlyPaymentError } from "@/lib/errors";
import { resolveInputToAddress } from "@/lib/nameService";

function formatUsd(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0.00";
  return `$${num.toFixed(2)}`;
}

export default function PayPage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const { data: balances } = useBalances();

  const availableTokens = useMemo(() => getTokensForChain(chainId), [chainId]);
  const [selectedTokenAddress, setSelectedTokenAddress] = useState("");
  const selectedToken =
    availableTokens.find((t) => t.address === selectedTokenAddress) ??
    getDefaultTokenForChain(chainId);
  const tokenSymbol = selectedToken?.symbol ?? "USDC";
  const confidentialTokenSymbol =
    selectedToken?.confidentialSymbol ?? `c${tokenSymbol}`;
  const tokenDecimals = selectedToken?.decimals ?? 6;
  const confidentialConfigured = isConfidentialTransferConfigured(chainId);

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"normal" | "confidential">("normal");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const fallback = getDefaultTokenForChain(chainId);
    if (!fallback) {
      setSelectedTokenAddress("");
      return;
    }
    const exists = availableTokens.some(
      (t) => t.address === selectedTokenAddress
    );
    if (!selectedTokenAddress || !exists) {
      setSelectedTokenAddress(fallback.address);
    }
  }, [availableTokens, chainId, selectedTokenAddress]);

  const usdcBalance = balances?.find(
    (b) => b.token.address === selectedToken?.address
  );
  const formattedBalance = usdcBalance
    ? formatUsd(usdcBalance.formatted)
    : "$0.00";

  const chainName =
    chainId === SUPPORTED_CHAINS.baseSepolia.id
      ? "Base"
      : chainId === SUPPORTED_CHAINS.arcTestnet.id
        ? "Arc"
        : chainId === SUPPORTED_CHAINS.tempoTestnet.id
          ? "Tempo"
          : "Network";

  const onPay = async () => {
    if (!isConnected || !chainId || !walletClient || !selectedToken) return;
    setLoading(true);
    setMessage(null);
    setStage(null);
    try {
      const tokenAddress = selectedToken.address;
      const recipientInput = recipient.trim();
      if (!recipientInput) throw new Error("Recipient is required.");
      if (mode === "confidential" && !confidentialConfigured) {
        throw new Error(
          `Confidential ${tokenSymbol} transfers are not configured for this chain.`
        );
      }
      setStage("Resolving recipient name...");
      const resolvedRecipient = await resolveInputToAddress(
        recipientInput,
        chainId
      );
      const amountRaw = ethers.parseUnits(amount || "0", tokenDecimals);
      if (amountRaw <= BigInt(0)) throw new Error("Enter a valid amount.");
      const recipientLabel =
        recipientInput.toLowerCase() === resolvedRecipient.toLowerCase()
          ? resolvedRecipient
          : `${recipientInput} → ${resolvedRecipient}`;

      const signer = await walletClientToSigner(walletClient);

      if (mode === "normal") {
        setStage("Sending normal payment...");
        const txHash = await transferUsdc(
          tokenAddress,
          resolvedRecipient,
          amountRaw,
          signer
        );
        address && logActivity(
          address,
          "direct_paid_normal",
          "Direct payment sent",
          `${ethers.formatUnits(amountRaw, tokenDecimals)} ${tokenSymbol} to ${recipientLabel}`,
          { chainId, txHash }
        );
        showSuccessToast(
          "Payment successful",
          `Direct ${tokenSymbol} transfer confirmed`
        );
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
        address && logActivity(
          address,
          "direct_paid_confidential",
          "Confidential direct payment submitted",
          `${ethers.formatUnits(amountRaw, tokenDecimals)} ${tokenSymbol} (confidential) to ${recipientLabel}`,
          { chainId, txHash }
        );
        showSuccessToast(
          "Payment successful",
          "Confidential transfer submitted"
        );
        setMessage("Confidential payment submitted.");
      }
    } catch (e) {
      const friendly = getUserFriendlyPaymentError(e);
      setMessage(friendly);
      if (friendly === "Transaction cancelled.") {
        showErrorToast("Transaction cancelled", "You cancelled the transaction in your wallet.");
      } else {
        showErrorToast("Payment failed", friendly);
      }
    } finally {
      setStage(null);
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <LayoutShell>
      <TransactionModal open={loading} stage={stage} />

      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="label-text text-brand-red">
            ■ FairSplit / Pay Now
          </p>
          <h1 className="mt-2 font-grotesk text-page-title font-bold uppercase text-brand-black underline decoration-brand-red decoration-4 underline-offset-4">
            Pay Now
          </h1>
          <p className="mt-2 text-body text-brand-ink">
            Send stable tokens directly or split bills with friends on{" "}
            {chainName}.
          </p>
        </div>
        <Link href="/create-bill">
          <Button variant="white" size="md">
            + New Split
          </Button>
        </Link>
      </div>

      <Ticker
        items={[
          `${tokenSymbol} ON ${chainName.toUpperCase()}`,
          "NORMAL & CONFIDENTIAL",
        ]}
      />

      <div className="mx-auto mt-8 grid max-w-4xl gap-6 md:grid-cols-2">
        <Card className="p-6">
          <p className="label-text text-brand-green">// Direct Payment</p>
          <h2 className="mt-1 font-grotesk text-card-title font-bold uppercase text-brand-black">
            Send {tokenSymbol}
          </h2>
          <p className="mt-2 text-body text-brand-ink">
            Send to any wallet address or ENS name on {chainName} network.
          </p>

          <div className="mt-5 space-y-4">
            {availableTokens.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <span className="label-text text-brand-muted">Token</span>
                <select
                  value={selectedTokenAddress}
                  onChange={(e) => setSelectedTokenAddress(e.target.value)}
                  className="w-full border-2 border-brand-black bg-brand-bg px-4 py-3 font-mono text-body text-brand-black focus:bg-brand-yellow focus:shadow-brutal focus:outline-none"
                >
                  {availableTokens.map((token) => (
                    <option key={token.address} value={token.address}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Input
              label="Recipient Address"
              id="recipient"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x... or alice.base or vitalik.eth"
            />
            <p className="font-mono text-xs text-brand-muted">
              // supports ENS names + base addresses
            </p>

            <div>
              <div className="flex items-baseline justify-between">
                <span className="label-text text-brand-muted">Amount ({tokenSymbol})</span>
                <span className="font-mono text-xs text-brand-muted">
                  Balance: {formattedBalance}
                </span>
              </div>
              <input
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10.00"
                className="mt-1.5 w-full border-2 border-brand-black bg-brand-bg px-4 py-3 font-grotesk text-body text-brand-black placeholder:text-brand-muted transition-all duration-75 focus:bg-brand-yellow focus:shadow-brutal focus:-translate-x-px focus:-translate-y-px focus:outline-none"
              />
            </div>

            <div>
              <p className="label-text mb-2 text-brand-muted">Payment Mode</p>
              <ModeToggle value={mode} onChange={setMode} />
            </div>

            <Button
              variant="red"
              size="lg"
              className="w-full"
              onClick={onPay}
              disabled={
                !isConnected ||
                !walletClient ||
                loading ||
                (mode === "confidential" && !confidentialConfigured)
              }
            >
              {loading
                ? "Processing..."
                : mode === "confidential" && !confidentialConfigured
                  ? `Confidential ${tokenSymbol} unavailable`
                  : `Pay Now →`}
            </Button>

            {stage && (
              <p className="font-mono text-xs text-brand-muted">{stage}</p>
            )}
            {message && (
              <p className="border-2 border-brand-black bg-white p-3 font-mono text-xs text-brand-ink">
                {message}
              </p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <p className="label-text text-brand-red">// Transaction Preview</p>
          <div className="mt-3">
            <p className="font-grotesk text-6xl font-bold text-brand-black">
              {amount || "0.00"}
            </p>
            <p className="mt-1 font-mono text-sm text-brand-muted">
              {tokenSymbol} · {chainName.toUpperCase()}
            </p>
          </div>

          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-brand-black pb-3">
              <span className="label-text text-brand-muted">Recipient</span>
              <span className="font-mono text-xs text-brand-black">
                {recipient ? recipient.slice(0, 20) + "..." : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between border-b-2 border-brand-black pb-3">
              <span className="label-text text-brand-muted">Network</span>
              <span className="font-mono text-xs text-brand-black">
                ■ {chainName}
              </span>
            </div>
            <div className="flex items-center justify-between border-b-2 border-brand-black pb-3">
              <span className="label-text text-brand-muted">Fee</span>
              <span className="font-mono text-xs text-brand-black">
                0.001 {tokenSymbol}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="label-text text-brand-muted">Total</span>
              <span className="flex items-center gap-2 font-mono text-xs font-bold text-brand-black">
                {amount
                  ? (parseFloat(amount) + 0.001).toFixed(3)
                  : "0.001"}{" "}
                {tokenSymbol}
                <Badge variant={loading ? "red" : "green"}>
                  {loading ? "PENDING" : "READY"}
                </Badge>
              </span>
            </div>
          </div>
        </Card>
      </div>

      {isConnected && address && (
        <div className="mx-auto mt-4 max-w-4xl border-2 border-brand-black bg-white p-4">
          <p className="label-text text-brand-muted">// Connected Wallet</p>
          <p className="mt-1 font-mono text-xs font-bold text-brand-black">
            {address.slice(0, 10)}...{address.slice(-8)}
          </p>
        </div>
      )}
    </LayoutShell>
  );
}
