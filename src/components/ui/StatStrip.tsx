"use client";

import { cn } from "@/lib/cn";

interface StatItem {
  label: string;
  value: string;
  sub?: string;
}

interface StatStripProps {
  items: StatItem[];
  className?: string;
}

export function StatStrip({ items, className }: StatStripProps) {
  return (
    <div
      className={cn(
        "grid border-2 border-brand-black bg-white",
        items.length === 4 && "grid-cols-2 md:grid-cols-4",
        items.length === 3 && "grid-cols-3",
        items.length === 2 && "grid-cols-2",
        items.length === 1 && "grid-cols-1",
        className
      )}
    >
      {items.map((item, i) => (
        <div
          key={item.label}
          className={cn(
            "px-4 py-3",
            i > 0 && "border-l-2 border-brand-black"
          )}
        >
          <p className="label-text text-brand-muted">{item.label}</p>
          <p className="mt-1 font-grotesk text-card-title font-bold text-brand-black">
            {item.value}
          </p>
          {item.sub && (
            <p className="mt-0.5 font-mono text-xs text-brand-muted">
              {item.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
