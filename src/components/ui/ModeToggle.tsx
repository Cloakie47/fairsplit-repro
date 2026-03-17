"use client";

import { cn } from "@/lib/cn";

type PaymentMode = "normal" | "confidential";

interface ModeToggleProps {
  value: PaymentMode;
  onChange: (mode: PaymentMode) => void;
  disabled?: boolean;
}

export function ModeToggle({ value, onChange, disabled }: ModeToggleProps) {
  return (
    <div className="flex border-2 border-brand-black">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("normal")}
        className={cn(
          "flex-1 px-4 py-2 font-mono text-label font-bold uppercase transition-all duration-75",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-black",
          value === "normal"
            ? "bg-brand-black text-brand-yellow"
            : "bg-white text-brand-black hover:bg-brand-yellow",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <span className="mr-1.5 inline-block h-2 w-2 border-2 border-current bg-brand-green" />
        Normal
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("confidential")}
        className={cn(
          "flex-1 border-l-2 border-brand-black px-4 py-2 font-mono text-label font-bold uppercase transition-all duration-75",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-black",
          value === "confidential"
            ? "bg-brand-black text-brand-yellow"
            : "bg-white text-brand-black hover:bg-brand-yellow",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <span className="mr-1.5 inline-block h-2 w-2 border-2 border-current bg-brand-muted" />
        Confidential
      </button>
    </div>
  );
}
