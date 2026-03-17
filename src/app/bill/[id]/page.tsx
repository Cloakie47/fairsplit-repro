"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAccount, useChainId, useWalletClient } from "wagmi";
import { ethers } from "ethers";

import { LayoutShell } from "@/components/LayoutShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ModeToggle } from "@/components/ui/ModeToggle";
import { TransactionModal } from "@/components/TransactionModal";

import { getContract } from "@/lib/contract";
import { walletClientToSigner } from "@/lib/wallet";
import {
  getDefaultTokenForChain,
  getTokenByAddress,
  CONTRACT_ADDRESSES,
} from "@/lib/chains";
import { approveUsdc } from "@/lib/usdc";
import { logActivity } from "@/lib/activity";
import { showSuccessToast } from "@/lib/toast";
import { markSplitRequestPaid } from "@/lib/requests";
import { resolveDisplayName } from "@/lib/friends";
import {
  isConfidentialTransferConfigured,
  performConfidentialPayment,
  preflightConfidentialPayment,
} from "@/lib/stabletrust";

interface BillData {
  creator: string;
  usdcToken: string;
  name: string;
  description: string;
  amountPerParticipant: bigint;
  participants: string[];
}

interface ParticipantStatus {
  paid: boolean;
  isConfidential: boolean;
  paidAt: bigint;
}

export default function BillDetailPage() {
  const params = useParams();
  const billId = typeof params.id === "string" ? decodeURIComponent(params.id) : "";
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  const [bill, setBill] = useState<BillData | null>(null);
  const [statuses, setStatuses] = useState<Map<string, ParticipantStatus>>(new Map());
  const [mode, setMode] = useState<"normal" | "confidential">("normal");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchBill = useCallback(async () => {
    if (!chainId || !billId) return;
    try {
      const rpc = new ethers.JsonRpcProvider(
        chainId === 84532
          ? "https://sepolia.base.org"
          : chainId === 5042002
            ? "https://rpc.testnet.arc.network"
            : "https://rpc.moderato.tempo.xyz"
      );
      const contract = getContract(rpc, chainId);
      const data = await contract.getBill(billId);
      const billData: BillData = {
        creator: data[0] as string,
        usdcToken: data[1] as string,
        name: data[2] as string,
        description: data[3] as string,
        amountPerParticipant: data[4] as bigint,
        participants: data[5] as string[],
      };
      setBill(billData);

      const statusMap = new Map<string, ParticipantStatus>();
      for (const p of billData.participants) {
        try {
          const s = await contract.getParticipantStatus(billId, p);
          statusMap.set(p.toLowerCase(), {
            paid: s[0] as boolean,
            isConfidential: s[1] as boolean,
            paidAt: s[2] as bigint,
          });
        } catch {
          statusMap.set(p.toLowerCase(), {
            paid: false,
            isConfidential: false,
            paidAt: BigInt(0),
          });
        }
      }
      setStatuses(statusMap);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to load bill.");
    }
  }, [chainId, billId]);

  useEffect(() => {
    void fetchBill();
  }, [fetchBill]);

  const token = bill ? getTokenByAddress(chainId, bill.usdcToken) : getDefaultTokenForChain(chainId);
  const tokenSymbol = token?.symbol ?? "USDC";
  const tokenDecimals = token?.decimals ?? 6;
  const confidentialConfigured = isConfidentialTransferConfigured(chainId);

  const myStatus = address ? statuses.get(address.toLowerCase()) : undefined;
  const alreadyPaid = myStatus?.paid ?? false;

  const onPay = async () => {
    if (!isConnected || !walletClient || !address || !bill) return;
    setLoading(true);
    setError(null);
    setStage(null);
    try {
      const signer = await walletClientToSigner(walletClient);
      const amountRaw = bill.amountPerParticipant;

      if (mode === "normal") {
        setStage("Approving token...");
        await approveUsdc(bill.usdcToken, CONTRACT_ADDRESSES[chainId], amountRaw, signer);
        setStage("Paying bill...");
        const contract = getContract(signer, chainId);
        const tx = await contract.payNormal(billId);
        setStage("Confirming...");
        await tx.wait();
        logActivity(address, "bill_paid_normal", `Paid "${bill.name}"`, `${ethers.formatUnits(amountRaw, tokenDecimals)} ${tokenSymbol}`, {
          chainId,
          txHash: tx.hash as string,
          billId,
        });
        markSplitRequestPaid({
          chainId,
          billId,
          participantAddress: address,
          mode: "normal",
          splitName: bill.name,
          creatorAddress: bill.creator,
        });
        showSuccessToast("Payment confirmed", `Paid ${bill.name}`);
        setStatuses((prev) => {
          const next = new Map(prev);
          next.set(address.toLowerCase(), {
            paid: true,
            isConfidential: false,
            paidAt: BigInt(Math.floor(Date.now() / 1000)),
          });
          return next;
        });
      } else {
        setStage("Running confidential preflight...");
        await preflightConfidentialPayment(signer, bill.creator, bill.usdcToken, amountRaw, chainId);
        setStage("Submitting confidential payment...");
        const txHash = await performConfidentialPayment(
          signer,
          bill.creator,
          bill.usdcToken,
          amountRaw,
          chainId,
          (next) => setStage(next)
        );
        logActivity(address, "bill_paid_confidential", `Paid "${bill.name}" (confidential)`, `${ethers.formatUnits(amountRaw, tokenDecimals)} ${tokenSymbol}`, {
          chainId,
          txHash,
          billId,
        });
        markSplitRequestPaid({
          chainId,
          billId,
          participantAddress: address,
          mode: "confidential",
          splitName: bill.name,
          creatorAddress: bill.creator,
        });
        showSuccessToast("Confidential payment submitted", `Paid ${bill.name}`);
        setStatuses((prev) => {
          const next = new Map(prev);
          next.set(address.toLowerCase(), {
            paid: true,
            isConfidential: true,
            paidAt: BigInt(Math.floor(Date.now() / 1000)),
          });
          return next;
        });
      }
      setTimeout(() => void fetchBill(), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed.");
    } finally {
      setStage(null);
      setLoading(false);
    }
  };

  return (
    <LayoutShell>
      <TransactionModal open={loading} stage={stage} />

      <p className="label-text text-brand-red">■ FairSplit / Bill Detail</p>
      <h1 className="mt-2 font-grotesk text-page-title font-bold uppercase text-brand-black underline decoration-brand-red decoration-4 underline-offset-4">
        {bill?.name ?? "Loading..."}
      </h1>

      {fetchError && (
        <Card className="mt-6 p-6">
          <p className="font-mono text-sm text-brand-red">{fetchError}</p>
        </Card>
      )}

      {bill && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <p className="label-text text-brand-muted">// Bill Info</p>
            <p className="mt-2 text-body text-brand-ink">{bill.description || "No description."}</p>
            <p className="mt-3 font-mono text-sm text-brand-black">
              Amount per person:{" "}
              <span className="font-bold">
                {ethers.formatUnits(bill.amountPerParticipant, tokenDecimals)} {tokenSymbol}
              </span>
            </p>
            <p className="mt-1 font-mono text-xs text-brand-muted">
              Creator: {bill.creator.slice(0, 8)}...{bill.creator.slice(-6)}
            </p>
          </Card>

          <Card className="p-6">
            <p className="label-text text-brand-muted">// Participants</p>
            <div className="mt-3 space-y-2">
              {bill.participants.map((p) => {
                const s = statuses.get(p.toLowerCase());
                const name = resolveDisplayName(address ?? null, p);
                return (
                  <div
                    key={p}
                    className="flex items-center justify-between border-2 border-brand-black bg-white px-3 py-2"
                  >
                    <span className="font-mono text-xs text-brand-black">{name}</span>
                    <Badge variant={s?.paid ? "green" : "red"}>
                      {s?.paid ? (s.isConfidential ? "PAID (C)" : "PAID") : "UNPAID"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {bill && !alreadyPaid && isConnected && address?.toLowerCase() !== bill.creator.toLowerCase() && (
        <Card className="mt-6 max-w-md p-6">
          <p className="label-text text-brand-green">// Pay Your Share</p>
          <div className="mt-3">
            <ModeToggle
              value={mode}
              onChange={setMode}
              disabled={!confidentialConfigured && mode !== "normal"}
            />
          </div>
          {error && (
            <p className="mt-3 border-2 border-brand-red p-2 font-mono text-xs text-brand-red">
              {error}
            </p>
          )}
          <Button
            variant="red"
            size="lg"
            className="mt-4 w-full"
            onClick={onPay}
            disabled={loading}
          >
            {loading ? "Processing..." : `Pay ${ethers.formatUnits(bill.amountPerParticipant, tokenDecimals)} ${tokenSymbol} →`}
          </Button>
        </Card>
      )}

      {alreadyPaid && (
        <div className="mt-6 max-w-md border-2 border-brand-black bg-white p-6 shadow-brutal">
          <p className="label-text text-brand-muted">// PAYMENT STATUS</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-brand-black bg-brand-green font-mono text-lg font-bold text-white">
              ✓
            </span>
            <div>
              <p className="font-grotesk text-base font-bold uppercase text-brand-black">
                Paid
              </p>
              <p className="mt-0.5 font-mono text-xs text-brand-muted">
                You have already paid this bill.
              </p>
            </div>
          </div>
        </div>
      )}
    </LayoutShell>
  );
}
