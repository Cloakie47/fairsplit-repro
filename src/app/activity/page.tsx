"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LayoutShell } from "@/components/LayoutShell";
import { ActivityType, getActivity } from "@/lib/activity";
import { getChainLabel, getTxExplorerUrl } from "@/lib/explorer";

const FILTERS: { id: "all" | ActivityType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "bill_created", label: "Split Created" },
  { id: "bill_paid_normal", label: "Split Paid (Normal)" },
  { id: "bill_paid_confidential", label: "Split Paid (Confidential)" },
  { id: "direct_paid_normal", label: "Direct Normal" },
  { id: "direct_paid_confidential", label: "Direct Confidential" },
  { id: "confidential_topup_completed", label: "Top-ups" },
  { id: "confidential_withdraw_completed", label: "Withdraws" },
  { id: "confidential_claim_completed", label: "Claims" },
];

export default function ActivityPage() {
  const [filter, setFilter] = useState<"all" | ActivityType>("all");
  const [page, setPage] = useState(1);
  const pageSize = 7;
  const items = useMemo(
    () => [...getActivity()].sort((a, b) => b.timestamp - a.timestamp),
    []
  );
  const filteredItems = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.type === filter)),
    [filter, items]
  );
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page]);

  const onPrev = () => setPage((p) => Math.max(1, p - 1));
  const onNext = () => setPage((p) => Math.min(totalPages, p + 1));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <LayoutShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">Activity</h1>
        <Link
          href="/app"
          className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          Back home
        </Link>
      </div>

      <div className="rounded-3xl border border-white/70 bg-white/85 p-6 backdrop-blur">
        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setFilter(item.id);
                setPage(1);
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                filter === item.id
                  ? "bg-black text-white"
                  : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-100"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {filteredItems.length === 0 ? (
          <p className="text-stone-600">No activity yet. Your split and payment actions will appear here.</p>
        ) : (
          <>
            <ul className="space-y-4">
              {pageItems.map((item) => (
              <li key={item.id} className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-stone-900">{item.title}</p>
                  {item.chainId && (
                    <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-700">
                      {getChainLabel(item.chainId)}
                    </span>
                  )}
                </div>
                {item.details && <p className="mt-1 text-sm text-stone-600">{item.details}</p>}
                {(() => {
                  const explorerUrl = getTxExplorerUrl(item.chainId, item.txHash);
                  if (!explorerUrl) return null;
                  return (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs font-semibold text-stone-700 hover:text-stone-900"
                    >
                      View tx ↗
                    </a>
                  );
                })()}
                <p className="mt-1 text-xs text-stone-500">
                  {new Date(item.timestamp).toLocaleString()}
                </p>
              </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-stone-200 bg-white px-3 py-2">
              <button
                type="button"
                onClick={onPrev}
                disabled={page <= 1}
                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 transition hover:bg-stone-100 disabled:opacity-50"
              >
                Prev
              </button>
              <span className="text-xs font-medium text-stone-600">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={onNext}
                disabled={page >= totalPages}
                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 transition hover:bg-stone-100 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </LayoutShell>
  );
}

