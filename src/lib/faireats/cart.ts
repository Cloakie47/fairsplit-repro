"use client";

/**
 * FairEats cart — localStorage, one cart per merchant, mirroring the pattern in
 * `src/lib/requests.ts` and `src/lib/profile.ts` (read/write plus a window
 * event so open components re-render).
 *
 * Money is bigint micro-USDC in memory and strings on disk, because
 * JSON.stringify cannot serialise bigint.
 */

import type { CartLine, SelectedOption } from "./types";

const STORAGE_PREFIX = "faireats_cart_";
const CART_EVENT = "faireats-cart-updated";

type StoredOption = Omit<SelectedOption, "priceDeltaMicro"> & {
  priceDeltaMicro: string;
};
type StoredLine = Omit<CartLine, "basePriceMicro" | "selected"> & {
  basePriceMicro: string;
  selected: StoredOption[];
};

function storageKey(merchantSlug: string): string {
  return `${STORAGE_PREFIX}${merchantSlug.toLowerCase()}`;
}

function toStored(line: CartLine): StoredLine {
  return {
    ...line,
    basePriceMicro: line.basePriceMicro.toString(),
    selected: line.selected.map((option) => ({
      ...option,
      priceDeltaMicro: option.priceDeltaMicro.toString(),
    })),
  };
}

function fromStored(line: StoredLine): CartLine {
  return {
    ...line,
    basePriceMicro: BigInt(line.basePriceMicro),
    selected: line.selected.map((option) => ({
      ...option,
      priceDeltaMicro: BigInt(option.priceDeltaMicro),
    })),
  };
}

/**
 * Two lines are the same cart entry when the item and the exact set of chosen
 * options match, so re-adding the same configuration bumps quantity instead of
 * creating a duplicate row. Option ids are sorted so selection order is
 * irrelevant.
 */
export function cartLineId(
  menuItemId: string,
  selected: SelectedOption[],
): string {
  const options = selected
    .map((option) => option.optionId)
    .slice()
    .sort()
    .join("+");
  return options ? `${menuItemId}|${options}` : menuItemId;
}

export function getCart(merchantSlug: string): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(merchantSlug));
    if (!raw) return [];
    return (JSON.parse(raw) as StoredLine[]).map(fromStored);
  } catch {
    return [];
  }
}

function setCart(merchantSlug: string, lines: CartLine[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey(merchantSlug),
      JSON.stringify(lines.map(toStored)),
    );
  } catch {
    // Quota or private-mode failure: the cart is a convenience, not a record.
  }
  window.dispatchEvent(new Event(CART_EVENT));
}

export function subscribeCart(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CART_EVENT, listener);
  return () => window.removeEventListener(CART_EVENT, listener);
}

export function addToCart(
  merchantSlug: string,
  line: Omit<CartLine, "lineId">,
): CartLine[] {
  const lineId = cartLineId(line.menuItemId, line.selected);
  const lines = getCart(merchantSlug);
  const existing = lines.find((entry) => entry.lineId === lineId);
  const quantity = Math.max(1, Math.floor(line.quantity));

  const next = existing
    ? lines.map((entry) =>
        entry.lineId === lineId
          ? { ...entry, quantity: entry.quantity + quantity }
          : entry,
      )
    : [...lines, { ...line, lineId, quantity }];

  setCart(merchantSlug, next);
  return next;
}

/** Quantity of 0 or less removes the line. */
export function setLineQuantity(
  merchantSlug: string,
  lineId: string,
  quantity: number,
): CartLine[] {
  const rounded = Math.floor(quantity);
  const lines = getCart(merchantSlug);
  const next =
    rounded <= 0
      ? lines.filter((entry) => entry.lineId !== lineId)
      : lines.map((entry) =>
          entry.lineId === lineId ? { ...entry, quantity: rounded } : entry,
        );
  setCart(merchantSlug, next);
  return next;
}

export function removeFromCart(
  merchantSlug: string,
  lineId: string,
): CartLine[] {
  return setLineQuantity(merchantSlug, lineId, 0);
}

export function clearCart(merchantSlug: string): void {
  setCart(merchantSlug, []);
}

export function cartItemCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/**
 * Default selections for an item, used to pre-fill the configurator so a
 * required single-select group is never left empty.
 */
export function defaultSelectionsFor(item: {
  groups: {
    id: string;
    name: string;
    kind: string;
    minSelect: number;
    options: {
      id: string;
      name: string;
      priceDeltaMicro: bigint;
      isDefault: boolean;
      isAvailable: boolean;
    }[];
  }[];
}): SelectedOption[] {
  const selected: SelectedOption[] = [];
  for (const group of item.groups) {
    const available = group.options.filter((option) => option.isAvailable);
    if (available.length === 0) continue;
    const preferred =
      available.find((option) => option.isDefault) ??
      (group.kind === "single" && group.minSelect > 0 ? available[0] : null);
    if (!preferred) continue;
    selected.push({
      groupId: group.id,
      groupName: group.name,
      optionId: preferred.id,
      optionName: preferred.name,
      priceDeltaMicro: preferred.priceDeltaMicro,
    });
  }
  return selected;
}
