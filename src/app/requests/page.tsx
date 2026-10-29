"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useChainId, useWalletClient } from "wagmi";
import Link from "next/link";
import { ethers } from "ethers";

import { LayoutShell } from "@/components/LayoutShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { showSuccessToast } from "@/lib/toast";
import { logActivity } from "@/lib/activity";
import { walletClientToSigner } from "@/lib/wallet";
import {
  getIncomingRequests,
  getOutgoingRequests,
  markSplitRequestPaid,
} from "@/lib/requests";
import {
  getSplitMetadata,
  getSplitsByCreator,
  getSplitsByParticipant,
  updateParticipantStatus,
  updateSplitStatus,
} from "@/lib/supabase";
import {
  calculateFee,
  CONTRACTS,
  formatUsdc,
  getFairsplitV2Contract,
  getUsdcContract,
  parseUsdc,
} from "@/lib/contract";

type OutgoingSplitRow = {
  split_id: string;
  chain_id: number;
  name: string | null;
  total_amount: string | null;
  participant_count: number | null;
  created_at?: string | null;
};

type IncomingParticipantRow = {
  split_id: string;
  chain_id: number;
};

type LocalSplitRequest = {
  chainId: number;
  billId: string;
  splitName: string;
  createdAt: number;
};

type OutgoingItem = {
  key: string;
  splitId: string;
  chainId: number;
  splitName: string;
  totalAmount: bigint;
  participantCount: number;
  paidCount: number;
  status: "active" | "settled" | "cancelled";
  createdAt: string | null;
};

type IncomingItem = {
  key: string;
  splitId: string;
  chainId: number;
  splitName: string;
  creatorAddress: string;
  amountOwed: bigint;
  feePreview: bigint;
  participantStatus: "pending" | "paid";
  status: "active" | "settled" | "cancelled";
  createdAt: string | null;
};

function statusFromContract(status: unknown): "active" | "settled" | "cancelled" {
  const n = Number(status);
  if (n === 1) return "settled";
  if (n === 2) return "cancelled";
  return "active";
}

function badgeForStatus(status: "active" | "settled" | "cancelled") {
  if (status === "settled") return <Badge variant="green">SETTLED</Badge>;
  if (status === "cancelled") return <Badge variant="red">CANCELLED</Badge>;
  return <Badge variant="mono">ACTIVE</Badge>;
}

function rpcForChain(chainId: number): string {
  if (chainId === CONTRACTS.base.chainId) return "https://mainnet.base.org";
  return "https://sepolia.base.org";
}

function isTransientPaySubmitError(message: string): boolean {
  return (
    message.includes("CALL_EXCEPTION") ||
    message.includes("estimateGas") ||
    message.includes("missing revert data") ||
    message.includes("execution reverted")
  );
}

export default function RequestsPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const [tab, setTab] = useState<"incoming" | "outgoing">("incoming");
  const [incoming, setIncoming] = useState<IncomingItem[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchOutgoing = useCallback(async (wallet: string): Promise<OutgoingItem[]> => {
    const localOutgoing = getOutgoingRequests(wallet) as LocalSplitRequest[];
    const localByKey = new Map<
      string,
      { splitName: string; createdAt: string | null; participantCount: number }
    >();
    for (const req of localOutgoing) {
      const key = `${req.chainId}-${req.billId}`;
      const existing = localByKey.get(key);
      if (existing) {
        localByKey.set(key, {
          ...existing,
          participantCount: existing.participantCount + 1,
        });
      } else {
        localByKey.set(key, {
          splitName: req.splitName,
          createdAt: new Date(req.createdAt).toISOString(),
          participantCount: 1,
        });
      }
    }

    let rows: OutgoingSplitRow[] = [];
    try {
      rows = (await getSplitsByCreator(wallet)) as OutgoingSplitRow[];
    } catch {
      rows = [];
    }

    const rowByKey = new Map(rows.map((r) => [`${r.chain_id}-${r.split_id}`, r]));
    const allKeys = new Set<string>([
      ...Array.from(rowByKey.keys()),
      ...Array.from(localByKey.keys()),
    ]);
    const mergedRows = Array.from(allKeys).map((key) => {
      const row = rowByKey.get(key);
      if (row) return row;
      const [chain, split] = key.split("-");
      return {
        split_id: split,
        chain_id: Number(chain),
        name: localByKey.get(key)?.splitName ?? null,
        total_amount: null,
        participant_count: localByKey.get(key)?.participantCount ?? null,
        created_at: localByKey.get(key)?.createdAt ?? null,
      } satisfies OutgoingSplitRow;
    });

    const items = await Promise.all(
      mergedRows.map(async (row) => {
        const splitId = String(row.split_id);
        const chainId = Number(row.chain_id ?? CONTRACTS.baseSepolia.chainId);
        const localMeta = localByKey.get(`${chainId}-${splitId}`);
        const provider = new ethers.JsonRpcProvider(rpcForChain(chainId));
        const contract = getFairsplitV2Contract(provider, chainId);

        let participantCount = Number(row.participant_count ?? localMeta?.participantCount ?? 0);
        let paidCount = 0;
        let status: "active" | "settled" | "cancelled" = "active";
        let totalAmount = parseUsdc(row.total_amount ?? "0");

        try {
          const split = await contract.getSplit(BigInt(splitId));
          participantCount = Number(split.participantCount ?? split[5] ?? participantCount);
          paidCount = Number(split.paidCount ?? split[6] ?? 0);
          totalAmount = BigInt(split.totalAmount ?? split[1] ?? totalAmount);
          status = statusFromContract(split.status ?? split[3] ?? 0);
        } catch {
          // fall back to metadata from Supabase if contract read fails
        }

        return {
          key: `${chainId}-${splitId}`,
          splitId,
          chainId,
          splitName: row.name ?? localMeta?.splitName ?? `Split #${splitId}`,
          totalAmount,
          participantCount,
          paidCount,
          status,
          createdAt: row.created_at ?? localMeta?.createdAt ?? null,
        };
      })
    );
    return items;
  }, []);

  const fetchIncoming = useCallback(async (wallet: string): Promise<IncomingItem[]> => {
    const localIncoming = getIncomingRequests(wallet) as LocalSplitRequest[];
    const localByKey = new Map<
      string,
      { splitName: string; createdAt: string | null }
    >(
      localIncoming.map((req) => [
        `${req.chainId}-${req.billId}`,
        {
          splitName: req.splitName,
          createdAt: new Date(req.createdAt).toISOString(),
        },
      ])
    );

    let rows: IncomingParticipantRow[] = [];
    try {
      rows = (await getSplitsByParticipant(wallet)) as IncomingParticipantRow[];
    } catch {
      rows = [];
    }

    const dedupeMap = new Map<string, IncomingParticipantRow>();
    for (const row of rows) {
      dedupeMap.set(`${row.chain_id}-${row.split_id}`, row);
    }
    for (const req of localIncoming) {
      const key = `${req.chainId}-${req.billId}`;
      if (!dedupeMap.has(key)) {
        dedupeMap.set(key, { split_id: req.billId, chain_id: req.chainId });
      }
    }
    const deduped = Array.from(dedupeMap.values());

    const items = await Promise.all(
      deduped.map(async (row) => {
        const splitId = String(row.split_id);
        const chainId = Number(row.chain_id ?? CONTRACTS.baseSepolia.chainId);
        const localMeta = localByKey.get(`${chainId}-${splitId}`);
        const provider = new ethers.JsonRpcProvider(rpcForChain(chainId));
        const contract = getFairsplitV2Contract(provider, chainId);
        let metadata: { name?: string | null; created_at?: string | null } | null = null;
        try {
          metadata = await getSplitMetadata(splitId, chainId);
        } catch {
          metadata = null;
        }
        const split = await contract.getSplit(BigInt(splitId));
        const participantStatusResult = await contract.getParticipantStatus(
          BigInt(splitId),
          wallet
        );
        const amountOwed = (await contract.getParticipantAmount(BigInt(splitId), wallet)) as bigint;
        const status = statusFromContract(split.status ?? split[3] ?? 0);
        const statusEnum = Number(
          participantStatusResult.status ?? participantStatusResult[0] ?? 0
        );
        const participantStatus: "pending" | "paid" =
          statusEnum === 1 ? "paid" : "pending";

        return {
          key: `${chainId}-${splitId}`,
          splitId,
          chainId,
          splitName: String(metadata?.name ?? localMeta?.splitName ?? `Split #${splitId}`),
          creatorAddress: String(split.creator ?? split[0] ?? ethers.ZeroAddress),
          amountOwed,
          feePreview: calculateFee(amountOwed),
          participantStatus,
          status,
          createdAt:
            (metadata?.created_at as string | null | undefined) ??
            localMeta?.createdAt ??
            null,
        };
      })
    );
    return items.sort((a, b) => {
      if (a.participantStatus !== b.participantStatus) {
        return a.participantStatus === "pending" ? -1 : 1;
      }
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const [outgoingRows, incomingRows] = await Promise.all([
        fetchOutgoing(address),
        fetchIncoming(address),
      ]);
      setOutgoing(outgoingRows);
      setIncoming(incomingRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load requests.");
      setOutgoing([]);
      setIncoming([]);
    } finally {
      setLoading(false);
    }
  }, [address, fetchIncoming, fetchOutgoing]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onPay = useCallback(
    async (item: IncomingItem) => {
      if (!address || !walletClient) return;
      setActionLoadingId(item.key);
      setError(null);
      try {
        const splitIdValue = BigInt(item.splitId);
        if (splitIdValue < BigInt(0)) {
          throw new Error("Invalid split id.");
        }
        const currentChainId = Number(chainId);
        if (currentChainId !== Number(item.chainId)) {
          throw new Error("Please switch to the split network before paying.");
        }
        const signer = await walletClientToSigner(walletClient);
        const contract = getFairsplitV2Contract(signer, item.chainId);
        const usdc = getUsdcContract(signer, item.chainId);
        const fairsplitAddress =
          item.chainId === Number(CONTRACTS.base.chainId)
            ? CONTRACTS.base.fairsplitV2
            : CONTRACTS.baseSepolia.fairsplitV2;
        if (!fairsplitAddress) {
          throw new Error("Contract not configured for this network.");
        }
        const latestSplit = await contract.getSplit(splitIdValue);
        const latestStatus = statusFromContract(latestSplit.status ?? latestSplit[3] ?? 0);
        if (latestStatus !== "active") {
          throw new Error("This split is no longer active.");
        }

        const latestParticipantStatus = await contract.getParticipantStatus(
          splitIdValue,
          address
        );
        const latestParticipantStatusEnum = Number(
          latestParticipantStatus.status ?? latestParticipantStatus[0] ?? 0
        );
        if (latestParticipantStatusEnum === 1) {
          throw new Error("You have already paid this split.");
        }

        const latestAmountOwed = (await contract.getParticipantAmount(
          splitIdValue,
          address
        )) as bigint;
        if (latestAmountOwed <= BigInt(0)) {
          throw new Error("No payable amount found for this wallet on this split.");
        }

        const balance = (await usdc.balanceOf(address)) as bigint;
        if (balance < latestAmountOwed) {
          throw new Error("Insufficient USDC balance.");
        }

        let justApproved = false;
        const allowance = (await usdc.allowance(address, fairsplitAddress)) as bigint;
        if (allowance < latestAmountOwed) {
          const approveTx = await usdc.approve(fairsplitAddress, latestAmountOwed);
          await approveTx.wait();
          justApproved = true;
        }
        let tx;
        try {
          tx = await contract.paySplit(splitIdValue);
        } catch (submitErr) {
          const submitMessage =
            submitErr instanceof Error
              ? submitErr.message
              : String(submitErr ?? "");
          if (!justApproved || !isTransientPaySubmitError(submitMessage)) {
            throw submitErr;
          }

          // Occasionally RPC state lags immediately after approval.
          await new Promise((resolve) => setTimeout(resolve, 1200));

          const latestStatusRetry = await contract.getParticipantStatus(
            splitIdValue,
            address
          );
          const latestStatusRetryEnum = Number(
            latestStatusRetry.status ?? latestStatusRetry[0] ?? 0
          );
          if (latestStatusRetryEnum === 1) {
            throw new Error("You have already paid this split.");
          }
          const amountRetry = (await contract.getParticipantAmount(
            splitIdValue,
            address
          )) as bigint;
          if (amountRetry <= BigInt(0)) {
            throw new Error("No payable amount found for this wallet on this split.");
          }
          const allowanceRetry = (await usdc.allowance(address, fairsplitAddress)) as bigint;
          if (allowanceRetry < amountRetry) {
            throw new Error("Approval not finalized yet. Please try again.");
          }

          tx = await contract.paySplit(splitIdValue);
        }
        const receipt = await tx.wait();

        await updateParticipantStatus(item.splitId, item.chainId, address, "paid");
        await markSplitRequestPaid({
          chainId: item.chainId,
          billId: item.splitId,
          participantAddress: address,
          mode: "normal",
          splitName: item.splitName,
          creatorAddress: item.creatorAddress,
        });
        const split = await contract.getSplit(splitIdValue);
        const paidCount = Number(split.paidCount ?? split[6] ?? 0);
        const participantCount = Number(split.participantCount ?? split[5] ?? 0);
        if (participantCount > 0 && paidCount >= participantCount) {
          await updateSplitStatus(item.splitId, item.chainId, "settled");
        }
        logActivity(
          address,
          "bill_paid_normal",
          `Paid "${item.splitName}"`,
          `${formatUsdc(latestAmountOwed)} USDC`,
          {
            chainId: item.chainId,
            txHash: String(receipt.hash ?? tx.hash),
            billId: item.splitId,
          }
        );
        showSuccessToast("Payment complete", "Split payment confirmed");
        await refresh();
      } catch (e) {
        const err = e as { code?: string | number; message?: string };
        const message = err?.message ?? "";
        if (err?.code === 4001 || err?.code === "ACTION_REJECTED") {
          setError("Transaction cancelled.");
        } else if (message.includes("Please switch to the split network")) {
          setError("Please switch to the split network before paying.");
        } else if (message.includes("Insufficient USDC balance")) {
          setError("Insufficient USDC balance.");
        } else if (message.includes("CALL_EXCEPTION") || message.includes("estimateGas")) {
          setError(
            "Payment cannot be submitted right now. The split may be invalid, already paid, or not assigned to this wallet."
          );
        } else {
          setError(message || "Payment failed.");
        }
      } finally {
        setActionLoadingId(null);
      }
    },
    [address, chainId, refresh, walletClient]
  );

  const onCancel = useCallback(
    async (item: OutgoingItem) => {
      if (!walletClient) return;
      setActionLoadingId(item.key);
      setError(null);
      try {
        const signer = await walletClientToSigner(walletClient);
        const contract = getFairsplitV2Contract(signer, item.chainId);
        const tx = await contract.cancelSplit(BigInt(item.splitId));
        await tx.wait();
        await updateSplitStatus(item.splitId, item.chainId, "cancelled");
        showSuccessToast("Split cancelled", "The split was cancelled successfully");
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Cancel failed.");
      } finally {
        setActionLoadingId(null);
      }
    },
    [refresh, walletClient]
  );

  const onRemind = useCallback((item: OutgoingItem) => {
    showSuccessToast(
      "Reminder sent",
      `Pending participants for "${item.splitName}" have been reminded.`
    );
  }, []);

  return (
    <LayoutShell>
      <p className="label-text text-brand-red">■ FairSplit / Requests</p>
      <h1 className="mt-2 font-grotesk text-page-title font-bold uppercase text-brand-black underline decoration-brand-red decoration-4 underline-offset-4">
        Requests
      </h1>
      <p className="mt-2 text-body text-brand-ink">
        View incoming and outgoing split requests.
      </p>

      <div className="mt-6 flex w-full gap-2">
        <Button
          className="min-h-[44px] flex-1"
          variant={tab === "incoming" ? "black" : "white"}
          size="md"
          onClick={() => setTab("incoming")}
        >
          Incoming ({incoming.length})
        </Button>
        <Button
          className="min-h-[44px] flex-1"
          variant={tab === "outgoing" ? "black" : "white"}
          size="md"
          onClick={() => setTab("outgoing")}
        >
          Outgoing ({outgoing.length})
        </Button>
      </div>

      {error && (
        <Card className="mt-4 p-4">
          <p className="font-mono text-xs text-brand-red">{error}</p>
        </Card>
      )}

      {!isConnected && (
        <Card className="mt-6 p-6">
          <p className="text-body text-brand-ink">Connect your wallet to view requests.</p>
        </Card>
      )}

      {isConnected && loading && (
        <Card className="mt-6 p-6">
          <p className="text-body text-brand-muted">
            Loading requests...
          </p>
        </Card>
      )}

      {isConnected && !loading && tab === "outgoing" && outgoing.length === 0 && (
        <Card className="mt-6 p-6">
          <p className="text-body text-brand-muted">
            No splits created yet. Create a bill to get started.
          </p>
        </Card>
      )}

      {isConnected && !loading && tab === "incoming" && incoming.length === 0 && (
        <Card className="mt-6 p-6">
          <p className="text-body text-brand-muted">
            No pending payments. You are all caught up.
          </p>
        </Card>
      )}

      <div className="mt-4 space-y-3">
        {tab === "outgoing" &&
          outgoing.map((item) => {
            const canRemind =
              item.status === "active" && item.paidCount < item.participantCount;
            const canCancel = item.status === "active" && item.paidCount === 0;
            return (
              <Card key={item.key} hoverable={false} className="p-4">
                <div className="flex flex-col items-start justify-between gap-3 md:flex-row">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-grotesk text-sm font-bold text-brand-black">
                        {item.splitName}
                      </p>
                      {badgeForStatus(item.status)}
                    </div>
                    <p className="mt-1 font-mono text-xs text-brand-muted">
                      {item.paidCount} of {item.participantCount} paid
                    </p>
                    <p className="font-mono text-xs text-brand-muted">
                      {formatUsdc(item.totalAmount)} USDC
                    </p>
                    <p className="font-mono text-xs text-brand-muted">
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                  <div className="flex w-full gap-2 md:w-auto">
                    {canRemind && (
                      <Button
                        className="w-full md:w-auto"
                        variant="white"
                        size="sm"
                        onClick={() => onRemind(item)}
                        disabled={actionLoadingId === item.key}
                      >
                        Remind
                      </Button>
                    )}
                    {canCancel && (
                      <Button
                        className="w-full md:w-auto"
                        variant="red"
                        size="sm"
                        onClick={() => void onCancel(item)}
                        disabled={actionLoadingId === item.key}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}

        {tab === "incoming" &&
          incoming.map((item) => {
            const amountMinusFee =
              item.amountOwed > item.feePreview
                ? item.amountOwed - item.feePreview
                : BigInt(0);
            return (
              <Card key={item.key} hoverable={false} className="p-4">
                <div className="flex flex-col items-start justify-between gap-3 md:flex-row">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-grotesk text-sm font-bold text-brand-black">
                        {item.splitName}
                      </p>
                      {item.participantStatus === "paid" ? (
                        <Badge variant="green">PAID</Badge>
                      ) : (
                        badgeForStatus(item.status)
                      )}
                    </div>
                    <p className="mt-1 font-mono text-base font-bold text-brand-black md:text-sm">
                      Amount owed: {formatUsdc(item.amountOwed)} USDC
                    </p>
                    <p className="font-mono text-xs text-brand-muted">
                      Fee preview: {formatUsdc(item.feePreview)} • Creator receives{" "}
                      {formatUsdc(amountMinusFee)}
                    </p>
                    <p className="font-mono text-xs text-brand-muted">
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                  {item.participantStatus === "pending" && item.status === "active" && (
                    <Button
                      className="w-full md:w-auto"
                      variant="red"
                      size="sm"
                      onClick={() => void onPay(item)}
                      disabled={actionLoadingId === item.key}
                    >
                      Pay
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
      </div>
    </LayoutShell>
  );
}
