"use client";

interface TransactionModalProps {
  open: boolean;
  stage: string | null;
}

export function TransactionModal({ open, stage }: TransactionModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-brand-black/60">
      <div className="w-80 border-2 border-brand-black bg-brand-cream p-6 text-center shadow-brutal">
        <div className="relative mx-auto mb-4 h-10 w-10">
          <div className="absolute inset-0 animate-spin border-4 border-brand-black border-t-brand-yellow" />
        </div>
        <p className="font-grotesk text-sm font-bold uppercase text-brand-black">
          Transaction in progress
        </p>
        {stage && (
          <p className="mt-2 font-mono text-xs text-brand-ink">{stage}</p>
        )}
        <p className="mt-3 font-mono text-label text-brand-muted">
          Do not close this page.
        </p>
      </div>
    </div>
  );
}
