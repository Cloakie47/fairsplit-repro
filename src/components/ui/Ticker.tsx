"use client";

import { cn } from "@/lib/cn";

interface TickerProps {
  items: string[];
  className?: string;
}

export function Ticker({ items, className }: TickerProps) {
  const segment = items.join("     ✦     ") + "     ✦     ";
  const repeated = segment.repeat(4);

  return (
    <div
      className={cn(
        "overflow-hidden border-y-2 border-brand-black bg-brand-yellow",
        className
      )}
    >
      <div
        className="flex w-max animate-marquee"
        style={{ willChange: "transform" }}
      >
        <span className="shrink-0 whitespace-nowrap py-2 pr-0 font-mono text-label font-bold uppercase tracking-widest text-brand-black">
          {repeated}
        </span>
        <span className="shrink-0 whitespace-nowrap py-2 pr-0 font-mono text-label font-bold uppercase tracking-widest text-brand-black">
          {repeated}
        </span>
      </div>
    </div>
  );
}
