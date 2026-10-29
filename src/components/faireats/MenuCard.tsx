"use client";

import { Badge } from "@/components/ui/Badge";
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
 * Compact grid card: fixed-aspect image, name, one-line description, price and
 * an Add button. Deliberately dense — the whole menu should be scannable
 * without scrolling past one item per screen.
 */
export function MenuCard({ item, disabled = false, onAdd }: MenuCardProps) {
  const customisable = item.groups.length > 0;
  const unavailable = disabled || !item.isAvailable;

  return (
    <Card className="flex h-full flex-col p-0">
      <FoodImage src={item.imagePath} alt={item.name} />

      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-grotesk text-body font-bold uppercase leading-tight text-brand-black">
            {item.name}
          </p>
          <Badge variant="mono" className="shrink-0">
            {formatMicro(item.basePriceMicro)}
          </Badge>
        </div>

        {item.description && (
          <p className="mt-1 truncate font-grotesk text-xs text-brand-muted">
            {item.description}
          </p>
        )}

        <div className="mt-3 flex-1" />

        <button
          type="button"
          disabled={unavailable}
          onClick={() => onAdd(item)}
          className={[
            "min-h-[40px] w-full border-2 border-brand-black px-3 py-2",
            "font-grotesk text-xs font-bold uppercase tracking-wide",
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
          <p className="label-text mt-1.5 text-center text-brand-muted">
            Customisable
          </p>
        )}
      </div>
    </Card>
  );
}
