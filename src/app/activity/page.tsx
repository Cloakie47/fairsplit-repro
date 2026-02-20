"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LayoutShell } from "@/components/LayoutShell";
import { ActivityType, getActivity } from "@/lib/activity";

const FILTERS: { id: "all" | ActivityType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "bill_created", label: "Split Created" },
  { id: "bill_paid_normal", label: "Split Paid (Normal)" },
  { id: "bill_paid_confidential", label: "Split Paid (Confidential)" },
  { id: "direct_paid_normal", label: "Direct Normal" },
  { id: "direct_paid_confidential", label: "Direct Confidential" },
  { id: "confidential_withdraw_completed", label: "Withdraws" },
];

export default function ActivityPage() {
  const [filter, setFilter] = useState<"all" | ActivityType>("all");
  const items = useMemo(() => getActivity(), []);
  const filteredItems = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.type === filter)),
    [filter, items]
  );

  return (
    <LayoutShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">Activity</h1>
        <Link
          href="/"
          className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800"
        >
          Back home
        </Link>
      </div>

      <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl backdrop-blur">
        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
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
          <ul className="space-y-4">
            {filteredItems.map((item) => (
              <li key={item.id} className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                <p className="font-medium text-stone-900">{item.title}</p>
                {item.details && <p className="mt-1 text-sm text-stone-600">{item.details}</p>}
                <p className="mt-1 text-xs text-stone-500">
                  {new Date(item.timestamp).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </LayoutShell>
  );
}

