"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { LayoutShell } from "@/components/LayoutShell";
import { FriendName } from "@/components/FriendName";
import { getIncomingRequests, getOutgoingRequests } from "@/lib/requests";

export default function RequestsPage() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<"incoming" | "outgoing">("incoming");
  const incoming = useMemo(
    () => (address ? getIncomingRequests(address) : []),
    [address]
  );
  const outgoing = useMemo(
    () => (address ? getOutgoingRequests(address) : []),
    [address]
  );
  const items = tab === "incoming" ? incoming : outgoing;

  return (
    <LayoutShell>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 md:text-3xl">Requests</h1>
        <Link
          href="/"
          className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-800 shadow-sm transition hover:bg-stone-100"
        >
          Back home
        </Link>
      </div>

      {!isConnected ? (
        <div className="rounded-2xl border border-stone-200 bg-white/95 p-5">
          <p className="text-stone-600">Connect wallet to see incoming and outgoing split requests.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white/95 p-5">
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setTab("incoming")}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                tab === "incoming"
                  ? "border border-[#d56ac7] bg-[#f7b8ee] text-stone-900"
                  : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-100"
              }`}
            >
              Incoming
            </button>
            <button
              type="button"
              onClick={() => setTab("outgoing")}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                tab === "outgoing"
                  ? "border border-[#d56ac7] bg-[#f7b8ee] text-stone-900"
                  : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-100"
              }`}
            >
              Outgoing
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-stone-600">No {tab} requests yet.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={`${item.id}-${item.status}`}
                  className="rounded-2xl border border-stone-200 bg-white px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-stone-900">{item.splitName}</p>
                      <p className="mt-1 text-xs text-stone-600">
                        {tab === "incoming" ? "From " : "To "}
                        <FriendName
                          viewerAddress={address}
                          address={
                            tab === "incoming"
                              ? item.creatorAddress
                              : item.participantAddress
                          }
                          className="font-semibold"
                        />
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {item.isConfidential ? "Confidential payment" : `${item.amountUsdc ?? "--"} USDC`}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`rounded-xl px-2.5 py-1 text-xs font-semibold ${
                          item.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : item.status === "paid_normal"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-violet-100 text-violet-800"
                        }`}
                      >
                        {item.status === "pending"
                          ? "Pending"
                          : item.status === "paid_normal"
                            ? "Paid (Normal)"
                            : "Paid (Confidential)"}
                      </span>
                      <div className="mt-2">
                        <Link
                          href={`/bill/${item.billId}`}
                          className="text-xs font-semibold text-stone-700 hover:text-stone-900"
                        >
                          Open split →
                        </Link>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </LayoutShell>
  );
}

