"use client";

type Participant = {
  address: string;
  paid: boolean;
  isConfidential: boolean;
};

type ParticipantListProps = {
  participants: Participant[];
  amountFormatted?: string;
};

function truncate(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function ParticipantList({
  participants,
  amountFormatted,
}: ParticipantListProps) {
  return (
    <ul className="divide-y divide-stone-200 rounded-3xl border border-white/70 bg-white/85 backdrop-blur">
      {participants.map((p) => (
        <li
          key={p.address}
          className="flex items-center justify-between px-5 py-4"
        >
          <span className="font-mono text-sm text-stone-700">
            {truncate(p.address)}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              p.paid
                ? p.isConfidential
                  ? "bg-amber-100 text-amber-900"
                  : "bg-emerald-100 text-emerald-900"
                : "bg-stone-100 text-stone-700"
            }`}
          >
            {p.paid
              ? p.isConfidential
                ? "Paid (Confidential)"
                : `Paid ${amountFormatted ?? ""}`
              : "Unpaid"}
          </span>
        </li>
      ))}
    </ul>
  );
}
