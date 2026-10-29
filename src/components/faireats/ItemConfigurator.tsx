"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { addToCart, defaultSelectionsFor } from "@/lib/faireats/cart";
import { formatMicro, lineUnitPriceMicro } from "@/lib/faireats/pricing";
import type { MenuItem, SelectedOption } from "@/lib/faireats/types";

interface ItemConfiguratorProps {
  merchantSlug: string;
  item: MenuItem;
  onClose: () => void;
  onAdded: () => void;
}

/**
 * McDonald's-style configurator: single-select size, multi-select add-ons,
 * live price, quantity. Rendered as an overlay rather than its own route so the
 * already-loaded menu is reused and the cart stays mounted.
 */
export function ItemConfigurator({
  merchantSlug,
  item,
  onClose,
  onAdded,
}: ItemConfiguratorProps) {
  const [selected, setSelected] = useState<SelectedOption[]>(() =>
    defaultSelectionsFor(item),
  );
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isChosen = (optionId: string) =>
    selected.some((option) => option.optionId === optionId);

  const toggle = (
    group: MenuItem["groups"][number],
    option: MenuItem["groups"][number]["options"][number],
  ) => {
    setSelected((current) => {
      const withoutOption = current.filter(
        (entry) => entry.optionId !== option.id,
      );
      const entry: SelectedOption = {
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionName: option.name,
        priceDeltaMicro: option.priceDeltaMicro,
      };

      if (group.kind === "single") {
        // Exactly one per group: replace whatever was chosen here.
        return [
          ...current.filter((item) => item.groupId !== group.id),
          entry,
        ];
      }

      if (isChosen(option.id)) {
        return withoutOption;
      }

      const chosenInGroup = current.filter(
        (item) => item.groupId === group.id,
      ).length;
      if (group.maxSelect !== undefined && chosenInGroup >= group.maxSelect) {
        return current;
      }
      return [...current, entry];
    });
  };

  const unresolvedGroup = useMemo(
    () =>
      item.groups.find(
        (group) =>
          selected.filter((entry) => entry.groupId === group.id).length <
          group.minSelect,
      ),
    [item.groups, selected],
  );

  const unitPrice = lineUnitPriceMicro({
    lineId: "",
    menuItemId: item.id,
    name: item.name,
    basePriceMicro: item.basePriceMicro,
    selected,
    quantity: 1,
  });
  const lineTotal = unitPrice * BigInt(quantity);

  const onAdd = () => {
    if (unresolvedGroup) return;
    addToCart(merchantSlug, {
      menuItemId: item.id,
      name: item.name,
      imagePath: item.imagePath,
      basePriceMicro: item.basePriceMicro,
      selected,
      quantity,
    });
    onAdded();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-brand-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto border-2 border-brand-black bg-brand-bg shadow-brutal-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b-2 border-brand-black bg-brand-cream px-5 py-4">
          <div>
            <p className="label-text text-brand-muted">// Customise</p>
            <h2 className="mt-1 font-grotesk text-card-title font-bold uppercase text-brand-black">
              {item.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-h-[44px] border-2 border-brand-black bg-white px-3 font-mono text-sm font-bold text-brand-black transition-all duration-75 hover:bg-brand-yellow md:min-h-0 md:py-1"
          >
            ✕
          </button>
        </div>

        {item.imagePath && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.imagePath}
            alt=""
            className="h-40 w-full border-b-2 border-brand-black object-cover"
          />
        )}

        <div className="px-5 py-4">
          {item.description && (
            <p className="font-grotesk text-body text-brand-ink">
              {item.description}
            </p>
          )}
          <p className="mt-2 font-mono text-xs text-brand-muted">
            Base {formatMicro(item.basePriceMicro)} USDC
          </p>

          {item.groups.map((group) => {
            const chosenCount = selected.filter(
              (entry) => entry.groupId === group.id,
            ).length;
            const atMax =
              group.maxSelect !== undefined && chosenCount >= group.maxSelect;
            return (
              <div key={group.id} className="mt-6">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="label-text text-brand-black">{group.name}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-brand-muted">
                    {group.kind === "single"
                      ? "Pick one"
                      : group.maxSelect !== undefined
                        ? `Up to ${group.maxSelect}`
                        : "Any"}
                  </p>
                </div>

                <div className="mt-2 grid gap-2">
                  {group.options.map((option) => {
                    const chosen = isChosen(option.id);
                    const blocked =
                      !option.isAvailable ||
                      (group.kind === "multi" && atMax && !chosen);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={blocked}
                        onClick={() => toggle(group, option)}
                        className={cn(
                          "flex min-h-[44px] items-center justify-between gap-3 border-2 border-brand-black px-4 py-2 text-left",
                          "font-grotesk text-body transition-all duration-75",
                          chosen
                            ? "bg-brand-yellow text-brand-black shadow-brutal"
                            : "bg-white text-brand-ink hover:bg-brand-cream",
                          blocked && "cursor-not-allowed opacity-40",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className={cn(
                              "inline-block h-3.5 w-3.5 border-2 border-brand-black",
                              chosen ? "bg-brand-black" : "bg-white",
                            )}
                          />
                          {option.name}
                        </span>
                        <span className="font-mono text-xs text-brand-muted">
                          {option.priceDeltaMicro === BigInt(0)
                            ? "—"
                            : `${option.priceDeltaMicro > BigInt(0) ? "+" : ""}${formatMicro(option.priceDeltaMicro)}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="mt-6 flex items-center justify-between gap-3 border-2 border-brand-black bg-white px-4 py-3">
            <p className="label-text text-brand-muted">Quantity</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="h-9 w-9 border-2 border-brand-black bg-white font-mono font-bold transition-all duration-75 hover:bg-brand-yellow"
              >
                −
              </button>
              <span className="w-10 text-center font-grotesk text-body font-bold">
                {quantity}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                className="h-9 w-9 border-2 border-brand-black bg-white font-mono font-bold transition-all duration-75 hover:bg-brand-yellow"
              >
                +
              </button>
            </div>
          </div>

          {unresolvedGroup && (
            <p className="mt-3 font-grotesk text-body text-brand-red">
              Choose a {unresolvedGroup.name.toLowerCase()} to continue.
            </p>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t-2 border-brand-black bg-brand-cream px-5 py-4">
          <div>
            <p className="label-text text-brand-muted">Line total</p>
            <p className="font-grotesk text-card-title font-bold text-brand-black">
              {formatMicro(lineTotal)} <span className="text-sm">USDC</span>
            </p>
          </div>
          <Button
            variant="yellow"
            size="lg"
            onClick={onAdd}
            disabled={!!unresolvedGroup}
          >
            Add to cart
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Small price pill used on the storefront grid. */
export function PriceTag({ micro }: { micro: bigint }) {
  return <Badge variant="mono">{formatMicro(micro)} USDC</Badge>;
}
