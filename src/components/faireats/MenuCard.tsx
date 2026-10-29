"use client";

import { Card } from "@/components/ui/Card";
import { FoodImage } from "@/components/faireats/FoodImage";
import { formatMicro } from "@/lib/faireats/pricing";
import type { MenuItem } from "@/lib/faireats/types";

interface MenuCardProps {
  item: MenuItem;
  disabled?: boolean;
  /** Items with option groups open the configurator; the rest add in one tap. */
  onAdd: (item: MenuItem) => void;
}

/**
 * A menu card, sized to be read rather than counted.
 *
 * Nothing here truncates the name. A card narrow enough to need that is a card
 * that is too narrow, so the grid guarantees a 300px floor instead. The
 * description is allowed two lines; beyond that it clamps, which is a
 * legibility choice rather than a space-saving one.
 */
export function MenuCard({ item, disabled = false, onAdd }: MenuCardProps) {
  const customisable = item.groups.length > 0;
  const unavailable = disabled || !item.isAvailable;

  return (
    <Card className="flex h-full flex-col p-0">
      <FoodImage src={item.imagePath} alt={item.name} />

      <div className="flex flex-1 flex-col p-4">
        <p className="font-grotesk text-card-title font-bold uppercase leading-tight text-brand-black">
          {item.name}
        </p>

        {item.description && (
          <p className="mt-1.5 line-clamp-2 font-grotesk text-body leading-snug text-brand-muted">
            {item.description}
          </p>
        )}

        <div className="mt-4 flex-1" />

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="label-text text-brand-muted">Price</p>
            <p className="font-grotesk text-card-title font-bold leading-none text-brand-black">
              {formatMicro(item.basePriceMicro)}{" "}
              <span className="font-mono text-xs">USDC</span>
            </p>
          </div>

          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              disabled={unavailable}
              onClick={() => onAdd(item)}
              className={[
                "min-h-[44px] border-2 border-brand-black px-6 py-2",
                "font-grotesk text-sm font-bold uppercase tracking-wide",
                "shadow-brutal transition-all duration-75",
                "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal-lg",
                "active:translate-x-1 active:translate-y-1 active:shadow-none",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-black",
                "disabled:pointer-events-none disabled:opacity-50",
                unavailable
                  ? "bg-white text-brand-black"
                  : "bg-brand-yellow text-brand-black",
              ].join(" ")}
            >
              {unavailable ? "Unavailable" : "Add"}
            </button>
            {customisable && !unavailable && (
              <p className="label-text text-brand-muted">Customisable</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
