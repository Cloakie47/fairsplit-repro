"use client";

export function TransactionModal({
  open,
  stage,
}: {
  open: boolean;
  stage: string | null;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[min(90vw,24rem)] rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-xl">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-stone-200 border-t-[#d56ac7]" />
        <p className="text-sm font-semibold text-stone-800">Transaction in progress</p>
        {stage && <p className="mt-2 text-sm text-stone-600">{stage}</p>}
        <p className="mt-3 text-xs text-stone-400">Please don&apos;t close this page.</p>
      </div>
    </div>
  );
}
