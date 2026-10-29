"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  clearCart,
  getCart,
  setLineQuantity,
  subscribeCart,
} from "@/lib/faireats/cart";
import {
  cartSubtotalMicro,
  describeSelections,
  formatMicro,
  lineTotalMicro,
} from "@/lib/faireats/pricing";
import type { CartLine } from "@/lib/faireats/types";

/** Shared cart state so the docked and slide-over forms stay in sync. */
function useCartLines(merchantSlug: string): CartLine[] {
  const [lines, setLines] = useState<CartLine[]>([]);
  useEffect(() => {
    const read = () => setLines(getCart(merchantSlug));
    read();
    return subscribeCart(read);
  }, [merchantSlug]);
  return lines;
}

function CartLines({
  merchantSlug,
  lines,
  compact = false,
}: {
  merchantSlug: string;
  lines: CartLine[];
  compact?: boolean;
}) {
  if (lines.length === 0) {
    return (
      <div className="border-2 border-brand-black bg-white px-4 py-6 text-center">
        <p className="label-text text-brand-muted">// Empty</p>
        <p className="mt-2 font-grotesk text-body text-brand-ink">
          Nothing here yet. Pick something from the menu.
        </p>
      </div>
    );
  }

  return (
    <>
      {lines.map((line) => {
        const summary = describeSelections(line.selected);
        return (
          <div
            key={line.lineId}
            className={cn(
              "mb-2 border-2 border-brand-black bg-white",
              compact ? "p-2.5" : "p-4",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-grotesk text-body font-bold uppercase text-brand-black">
                  {line.name}
                </p>
                {summary && (
                  <p className="mt-0.5 truncate font-mono text-[10px] text-brand-muted">
                    {summary}
                  </p>
                )}
              </div>
              <p className="whitespace-nowrap font-grotesk text-body font-bold text-brand-black">
                {formatMicro(lineTotalMicro(line))}
              </p>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label={`Decrease ${line.name}`}
                  onClick={() =>
                    setLineQuantity(merchantSlug, line.lineId, line.quantity - 1)
                  }
                  className="h-8 w-8 border-2 border-brand-black bg-white font-mono font-bold transition-all duration-75 hover:bg-brand-yellow"
                >
                  −
                </button>
                <span className="w-7 text-center font-grotesk text-body font-bold">
                  {line.quantity}
                </span>
                <button
                  type="button"
                  aria-label={`Increase ${line.name}`}
                  onClick={() =>
                    setLineQuantity(merchantSlug, line.lineId, line.quantity + 1)
                  }
                  className="h-8 w-8 border-2 border-brand-black bg-white font-mono font-bold transition-all duration-75 hover:bg-brand-yellow"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => setLineQuantity(merchantSlug, line.lineId, 0)}
                className="font-mono text-[10px] font-bold uppercase tracking-wide text-brand-red underline"
              >
                Remove
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}

function CartFooter({
  merchantSlug,
  lines,
}: {
  merchantSlug: string;
  lines: CartLine[];
}) {
  return (
    <>
      <div className="flex items-baseline justify-between">
        <p className="label-text text-brand-muted">Subtotal</p>
        <p className="font-grotesk text-card-title font-bold text-brand-black">
          {formatMicro(cartSubtotalMicro(lines))}{" "}
          <span className="text-sm">USDC</span>
        </p>
      </div>

      <div className="mt-3 grid gap-2">
        {/* Checkout is intentionally not wired up yet: table selection and the
            payment flow land after the storefront. */}
        <Button variant="black" size="md" disabled className="w-full">
          Checkout — coming next
        </Button>
        {lines.length > 0 && (
          <button
            type="button"
            onClick={() => clearCart(merchantSlug)}
            className={cn(
              "min-h-[40px] border-2 border-brand-black bg-white px-4 py-2",
              "font-grotesk text-xs font-bold uppercase text-brand-black",
              "transition-all duration-75 hover:bg-brand-red hover:text-white",
            )}
          >
            Clear cart
          </button>
        )}
      </div>
    </>
  );
}

/**
 * Desktop cart, docked in the right column. Sticky so it stays with the menu
 * as the grid scrolls.
 */
export function CartDock({ merchantSlug }: { merchantSlug: string }) {
  const lines = useCartLines(merchantSlug);
  return (
    <div className="sticky top-6 border-2 border-brand-black bg-brand-cream shadow-brutal">
      <div className="border-b-2 border-brand-black bg-brand-bg px-4 py-3">
        <p className="label-text text-brand-muted">// Your order</p>
        <p className="mt-0.5 font-grotesk text-card-title font-bold uppercase text-brand-black">
          Cart
        </p>
      </div>
      <div className="max-h-[42vh] overflow-y-auto px-4 pt-3">
        <CartLines merchantSlug={merchantSlug} lines={lines} compact />
      </div>
      <div className="border-t-2 border-brand-black px-4 py-3">
        <CartFooter merchantSlug={merchantSlug} lines={lines} />
      </div>
    </div>
  );
}

interface CartPanelProps {
  merchantSlug: string;
  open: boolean;
  onClose: () => void;
}

/** Mobile slide-over. Desktop uses CartDock instead. */
export function CartPanel({ merchantSlug, open, onClose }: CartPanelProps) {
  const lines = useCartLines(merchantSlug);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-brand-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Cart"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-md flex-col border-l-2 border-brand-black bg-brand-bg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b-2 border-brand-black bg-brand-cream px-5 py-4">
          <div>
            <p className="label-text text-brand-muted">// Your order</p>
            <h2 className="mt-1 font-grotesk text-card-title font-bold uppercase text-brand-black">
              Cart
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="min-h-[44px] border-2 border-brand-black bg-white px-3 font-mono text-sm font-bold text-brand-black transition-all duration-75 hover:bg-brand-yellow md:min-h-0 md:py-1"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <CartLines merchantSlug={merchantSlug} lines={lines} />
        </div>

        <div className="border-t-2 border-brand-black bg-brand-cream px-5 py-4">
          <CartFooter merchantSlug={merchantSlug} lines={lines} />
        </div>
      </div>
    </div>
  );
}
