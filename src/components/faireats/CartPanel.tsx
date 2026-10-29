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

interface CartPanelProps {
  merchantSlug: string;
  open: boolean;
  onClose: () => void;
}

export function CartPanel({ merchantSlug, open, onClose }: CartPanelProps) {
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    const read = () => setLines(getCart(merchantSlug));
    read();
    return subscribeCart(read);
  }, [merchantSlug]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const subtotal = cartSubtotalMicro(lines);

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
          {lines.length === 0 && (
            <div className="border-2 border-brand-black bg-white px-4 py-6 text-center">
              <p className="label-text text-brand-muted">// Empty</p>
              <p className="mt-2 font-grotesk text-body text-brand-ink">
                Nothing here yet. Pick something from the menu.
              </p>
            </div>
          )}

          {lines.map((line) => {
            const summary = describeSelections(line.selected);
            return (
              <div
                key={line.lineId}
                className="mb-3 border-2 border-brand-black bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-grotesk text-body font-bold uppercase text-brand-black">
                      {line.name}
                    </p>
                    {summary && (
                      <p className="mt-1 font-mono text-xs text-brand-muted">
                        {summary}
                      </p>
                    )}
                  </div>
                  <p className="whitespace-nowrap font-grotesk text-body font-bold text-brand-black">
                    {formatMicro(lineTotalMicro(line))}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Decrease ${line.name}`}
                      onClick={() =>
                        setLineQuantity(
                          merchantSlug,
                          line.lineId,
                          line.quantity - 1,
                        )
                      }
                      className="h-9 w-9 border-2 border-brand-black bg-white font-mono font-bold transition-all duration-75 hover:bg-brand-yellow"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-grotesk text-body font-bold">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase ${line.name}`}
                      onClick={() =>
                        setLineQuantity(
                          merchantSlug,
                          line.lineId,
                          line.quantity + 1,
                        )
                      }
                      className="h-9 w-9 border-2 border-brand-black bg-white font-mono font-bold transition-all duration-75 hover:bg-brand-yellow"
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
        </div>

        <div className="border-t-2 border-brand-black bg-brand-cream px-5 py-4">
          <div className="flex items-baseline justify-between">
            <p className="label-text text-brand-muted">Subtotal</p>
            <p className="font-grotesk text-card-title font-bold text-brand-black">
              {formatMicro(subtotal)} <span className="text-sm">USDC</span>
            </p>
          </div>

          <div className="mt-4 grid gap-2">
            {/* Checkout is intentionally not wired up yet: table selection and
                the payment flow land after the storefront. */}
            <Button variant="black" size="lg" disabled className="w-full">
              Checkout — coming next
            </Button>
            {lines.length > 0 && (
              <button
                type="button"
                onClick={() => clearCart(merchantSlug)}
                className={cn(
                  "min-h-[44px] border-2 border-brand-black bg-white px-4 py-2",
                  "font-grotesk text-sm font-bold uppercase text-brand-black",
                  "transition-all duration-75 hover:bg-brand-red hover:text-white",
                )}
              >
                Clear cart
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
