"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";

import { LayoutShell } from "@/components/LayoutShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

import { useTransactionHistory } from "@/lib/queries";
import { getChainLabel, getTxExplorerUrl } from "@/lib/explorer";
import type { ActivityType } from "@/lib/activity";

const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  bill_created: "Bill Created",
  bill_paid_normal: "Bill Paid",
  bill_paid_confidential: "Bill Paid (Confidential)",
  direct_paid_normal: "Direct Payment",
  direct_paid_confidential: "Direct Payment (Confidential)",
  usdc_bridged: "USDC Bridged",
  confidential_account_initialized: "Account Initialized",
  confidential_balance_refreshed: "Balance Refreshed",
  confidential_topup_completed: "Top-Up Complete",
  confidential_withdraw_completed: "Withdraw Complete",
  confidential_claim_completed: "Claim Complete",
};

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "payments", label: "Payments" },
  { value: "bills", label: "Bills" },
  { value: "confidential", label: "Confidential" },
  { value: "bridge", label: "Bridge" },
];

const PAGE_SIZE = 10;

export default function ActivityPage() {
  const { isConnected } = useAccount();
  const { data: items, isLoading } = useTransactionHistory();
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!items) return [];
    switch (filter) {
      case "payments":
        return items.filter(
          (i) =>
            i.type === "direct_paid_normal" ||
            i.type === "direct_paid_confidential"
        );
      case "bills":
        return items.filter(
          (i) =>
            i.type === "bill_created" ||
            i.type === "bill_paid_normal" ||
            i.type === "bill_paid_confidential"
        );
      case "confidential":
        return items.filter(
          (i) =>
            i.type.includes("confidential")
        );
      case "bridge":
        return items.filter((i) => i.type === "usdc_bridged");
      default:
        return items;
    }
  }, [items, filter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <LayoutShell>
      <p className="label-text text-brand-red">■ FairSplit / Activity</p>
      <h1 className="mt-2 font-grotesk text-page-title font-bold uppercase text-brand-black underline decoration-brand-red decoration-4 underline-offset-4">
        Activity
      </h1>
      <p className="mt-2 text-body text-brand-ink">
        View your transaction history across all chains.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={filter === opt.value ? "black" : "white"}
            size="sm"
            onClick={() => {
              setFilter(opt.value);
              setPage(0);
            }}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {!isConnected && (
          <Card className="p-6">
            <p className="text-body text-brand-ink">
              Connect your wallet to view activity.
            </p>
          </Card>
        )}

        {isConnected && isLoading && (
          <Card className="p-6">
            <p className="font-mono text-sm text-brand-muted">Loading activity...</p>
          </Card>
        )}

        {isConnected && !isLoading && pageItems.length === 0 && (
          <Card className="p-6">
            <p className="text-body text-brand-ink">No activity found.</p>
          </Card>
        )}

        {pageItems.map((item) => {
          const explorerUrl = getTxExplorerUrl(item.chainId, item.txHash);
          return (
            <Card key={item.id} hoverable={false} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-grotesk text-sm font-bold text-brand-black">
                      {item.title}
                    </p>
                    <Badge variant="mono">
                      {ACTIVITY_TYPE_LABELS[item.type] ?? item.type}
                    </Badge>
                  </div>
                  {item.details && (
                    <p className="mt-1 font-mono text-xs text-brand-muted">
                      {item.details}
                    </p>
                  )}
                  <p className="mt-1 font-mono text-xs text-brand-muted">
                    {item.chainId ? getChainLabel(item.chainId) : ""} ·{" "}
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                </div>
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-2 border-brand-black px-2 py-1 font-mono text-label text-brand-black transition-all duration-75 hover:bg-brand-yellow"
                  >
                    View TX →
                  </a>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            variant="white"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ← Prev
          </Button>
          <span className="font-mono text-label text-brand-muted">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="white"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Next →
          </Button>
        </div>
      )}
    </LayoutShell>
  );
}
