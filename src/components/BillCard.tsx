"use client";

import Link from "next/link";

type BillCardProps = {
  billId: string;
  name: string;
  participantCount: number;
  amountPerParticipant: string;
};

export function BillCard({
  billId,
  name,
  participantCount,
  amountPerParticipant,
}: BillCardProps) {
  return (
    <Link
      href={`/bill/${billId}`}
      className="block rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition hover:border-stone-300 hover:shadow"
    >
      <div className="font-medium text-stone-900">{name}</div>
      <div className="mt-1 text-sm text-stone-500">
        {participantCount} participant{participantCount !== 1 ? "s" : ""} ·{" "}
        {amountPerParticipant} each
      </div>
    </Link>
  );
}
