"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";

import { LayoutShell } from "@/components/LayoutShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

import {
  getIncomingRequests,
  getOutgoingRequests,
  type SplitRequest,
} from "@/lib/requests";
import { resolveDisplayName } from "@/lib/friends";

export default function RequestsPage() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<"incoming" | "outgoing">("incoming");
  const [incoming, setIncoming] = useState<SplitRequest[]>([]);
  const [outgoing, setOutgoing] = useState<SplitRequest[]>([]);

  const refresh = useCallback(() => {
    if (!address) return;
    setIncoming(getIncomingRequests(address));
    setOutgoing(getOutgoingRequests(address));
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeRequests = tab === "incoming" ? incoming : outgoing;

  return (
    <LayoutShell>
      <p className="label-text text-brand-red">■ FairSplit / Requests</p>
      <h1 className="mt-2 font-grotesk text-page-title font-bold uppercase text-brand-black underline decoration-brand-red decoration-4 underline-offset-4">
        Requests
      </h1>
      <p className="mt-2 text-body text-brand-ink">
        View incoming and outgoing split requests.
      </p>

      <div className="mt-6 flex gap-2">
        <Button
          variant={tab === "incoming" ? "black" : "white"}
          size="md"
          onClick={() => setTab("incoming")}
        >
          Incoming ({incoming.length})
        </Button>
        <Button
          variant={tab === "outgoing" ? "black" : "white"}
          size="md"
          onClick={() => setTab("outgoing")}
        >
          Outgoing ({outgoing.length})
        </Button>
      </div>

      {!isConnected && (
        <Card className="mt-6 p-6">
          <p className="text-body text-brand-ink">Connect your wallet to view requests.</p>
        </Card>
      )}

      {isConnected && activeRequests.length === 0 && (
        <Card className="mt-6 p-6">
          <p className="text-body text-brand-muted">
            No {tab} requests found.
          </p>
        </Card>
      )}

      <div className="mt-4 space-y-3">
        {activeRequests.map((req) => {
          const statusBadge =
            req.status === "pending" ? (
              <Badge variant="red">Pending</Badge>
            ) : (
              <Badge variant="green">
                {req.status === "paid_confidential" ? "Paid (C)" : "Paid"}
              </Badge>
            );

          const counterparty =
            tab === "incoming"
              ? resolveDisplayName(address ?? null, req.creatorAddress)
              : resolveDisplayName(address ?? null, req.participantAddress);

          return (
            <Card key={req.id} hoverable={false} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-grotesk text-sm font-bold text-brand-black">
                      {req.splitName}
                    </p>
                    {statusBadge}
                  </div>
                  <p className="mt-1 font-mono text-xs text-brand-muted">
                    {tab === "incoming" ? "From" : "To"}: {counterparty}
                  </p>
                  {req.amountUsdc && (
                    <p className="font-mono text-xs text-brand-muted">
                      {req.amountUsdc} {req.tokenSymbol ?? "USDC"}
                    </p>
                  )}
                  <p className="font-mono text-xs text-brand-muted">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {req.status === "pending" && tab === "incoming" && (
                  <Link href={`/bill/${encodeURIComponent(req.billId)}`}>
                    <Button variant="red" size="sm">
                      Pay →
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </LayoutShell>
  );
}
