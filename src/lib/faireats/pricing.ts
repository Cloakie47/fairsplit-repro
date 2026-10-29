/**
 * FairEats pricing and share math. Pure functions over bigint micro-USDC — no
 * floats anywhere, so nothing drifts between the cart, the database and the
 * contract call.
 *
 * Share allocation deliberately mirrors FairsplitV2 rather than reimplementing
 * it. See `splitPlanForEqual` and `splitPlanForFixed`.
 */

import { ONE_USDC_MICRO, USDC_DECIMALS } from "./config";
import type { CartLine, SelectedOption } from "./types";

/** "12.34" -> 12340000 micro-USDC. Rejects anything not a plain decimal. */
export function parseUsdcToMicro(display: string): bigint {
  const trimmed = (display ?? "").trim();
  if (!/^\d+(\.\d{0,6})?$/.test(trimmed)) {
    throw new Error("Enter an amount with up to 6 decimal places.");
  }
  const [whole, frac = ""] = trimmed.split(".");
  const padded = frac.padEnd(USDC_DECIMALS, "0");
  return BigInt(whole) * ONE_USDC_MICRO + BigInt(padded || "0");
}

/** 12340000 micro-USDC -> "12.34". Always two decimals for display. */
export function formatMicro(micro: bigint): string {
  const negative = micro < BigInt(0);
  const abs = negative ? -micro : micro;
  const whole = abs / ONE_USDC_MICRO;
  const cents = (abs % ONE_USDC_MICRO) / BigInt(10_000);
  return `${negative ? "-" : ""}${whole}.${cents.toString().padStart(2, "0")}`;
}

/** Micro-USDC equals raw contract units, so this is an identity with intent. */
export function microToContractAmount(micro: bigint): bigint {
  return micro;
}

export function optionsDeltaMicro(selected: SelectedOption[]): bigint {
  return selected.reduce((sum, option) => sum + option.priceDeltaMicro, BigInt(0));
}

/** Base price plus the selected options, for one unit. */
export function lineUnitPriceMicro(line: CartLine): bigint {
  const unit = line.basePriceMicro + optionsDeltaMicro(line.selected);
  return unit > BigInt(0) ? unit : BigInt(0);
}

export function lineTotalMicro(line: CartLine): bigint {
  return lineUnitPriceMicro(line) * BigInt(Math.max(0, line.quantity));
}

export function cartSubtotalMicro(lines: CartLine[]): bigint {
  return lines.reduce((sum, line) => sum + lineTotalMicro(line), BigInt(0));
}

/**
 * A plan for calling FairsplitV2.createSplit, in the contract's own terms.
 *
 * `splitType` matches the on-chain enum: 0 EQUAL, 1 UNEQUAL_FIXED,
 * 2 UNEQUAL_PERCENTAGE. FairEats only uses 0 and 1.
 */
export type SplitPlan = {
  splitType: 0 | 1;
  participants: string[];
  totalAmountMicro: bigint;
  /** Empty for EQUAL; one entry per participant for UNEQUAL_FIXED. */
  customAmountsMicro: bigint[];
  /** Per-participant share for display and for the offchain shares table. */
  displayShares: { address: string; shareMicro: bigint }[];
  /**
   * EQUAL only. Integer division leaves this many micro-USDC unallocated; the
   * contract gives it to whoever pays last, so no share is ever lost.
   */
  remainderMicro: bigint;
};

/**
 * Equal split, delegating the arithmetic to the contract.
 *
 * FairsplitV2.getParticipantAmount returns `totalAmount / participantCount`
 * for EQUAL splits, except for the final unpaid participant, who is charged
 * `totalAmount - totalPaid` and therefore absorbs the integer-division
 * remainder. We reproduce exactly that floor division here and report the
 * remainder rather than redistributing it ourselves, so the offchain view can
 * never disagree with what `paySplit` will actually charge.
 */
export function splitPlanForEqual(
  participants: string[],
  totalAmountMicro: bigint,
): SplitPlan {
  assertParticipants(participants);
  if (totalAmountMicro <= BigInt(0)) {
    throw new Error("Order total must be greater than zero.");
  }
  const count = BigInt(participants.length);
  const base = totalAmountMicro / count;
  if (base <= BigInt(0)) {
    throw new Error(
      "Order total is too small to split between this many people.",
    );
  }
  return {
    splitType: 0,
    participants,
    totalAmountMicro,
    customAmountsMicro: [],
    displayShares: participants.map((address) => ({
      address,
      shareMicro: base,
    })),
    remainderMicro: totalAmountMicro - base * count,
  };
}

/**
 * Unequal split with explicit per-participant amounts, used for per-item
 * attribution. The contract requires the amounts to sum exactly to the total
 * (`require(fixedSum == totalAmount)`), so we assert the same thing here and
 * fail in the UI rather than at the transaction.
 */
export function splitPlanForFixed(
  shares: { address: string; shareMicro: bigint }[],
  totalAmountMicro: bigint,
): SplitPlan {
  assertParticipants(shares.map((s) => s.address));
  if (totalAmountMicro <= BigInt(0)) {
    throw new Error("Order total must be greater than zero.");
  }
  if (shares.some((s) => s.shareMicro <= BigInt(0))) {
    throw new Error("Every participant must owe more than zero.");
  }
  const sum = shares.reduce((acc, s) => acc + s.shareMicro, BigInt(0));
  if (sum !== totalAmountMicro) {
    throw new Error(
      `Shares add up to ${formatMicro(sum)} but the order total is ${formatMicro(
        totalAmountMicro,
      )}.`,
    );
  }
  return {
    splitType: 1,
    participants: shares.map((s) => s.address),
    totalAmountMicro,
    customAmountsMicro: shares.map((s) => s.shareMicro),
    displayShares: shares,
    remainderMicro: BigInt(0),
  };
}

function assertParticipants(addresses: string[]): void {
  if (addresses.length === 0) {
    throw new Error("Add at least one participant to split with.");
  }
  const seen = new Set<string>();
  for (const address of addresses) {
    const key = address.toLowerCase();
    if (seen.has(key)) {
      // The contract rejects duplicates outright: require(!s.isParticipant[p]).
      throw new Error("The same person was added twice.");
    }
    seen.add(key);
  }
}

/** Human-readable one-liner for a configured cart line. */
export function describeSelections(selected: SelectedOption[]): string {
  if (selected.length === 0) return "";
  return selected.map((option) => option.optionName).join(", ");
}
