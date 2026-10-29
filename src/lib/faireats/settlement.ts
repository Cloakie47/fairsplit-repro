/**
 * FairEats settlement model: per-participant `directPay`, split ledger offchain.
 *
 * ---------------------------------------------------------------------------
 * DECISION RECORD — settled, do not re-litigate.
 * ---------------------------------------------------------------------------
 *
 * Each participant calls `FairsplitV2.directPay(mcFairPayoutAddress, theirShare)`
 * for their own share. There is no on-chain split object. The authoritative
 * share ledger lives in `faireats_order_participants`, and settlement is
 * confirmed by verifying each participant's transaction against the chain.
 *
 * Why: nobody fronts the bill, nobody becomes a collection point, the merchant
 * is paid directly, no hot wallet is required, merchant downtime cannot block
 * ordering, and `directPay` charges zero protocol fee against `paySplit`'s
 * 0.30% per share (FairsplitV2 line 395 transfers the full amount; line 278
 * applies the tiered fee only on the `paySplit` path).
 *
 * Alternatives considered and rejected:
 *
 *  - **Payer-fronts** (`directPay` the total, then `createSplit` so participants
 *    repay the payer). Rejected: one person carries the whole bill and the
 *    collection risk. That is precisely the Splitwise failure mode Fairsplit
 *    exists to fix.
 *
 *  - **Customer-collects** (`createSplit` first, shares land on the creator, who
 *    then pays the merchant). Rejected: inverts the risk instead of removing it
 *    — the merchant is now exposed to the customer absconding with collected
 *    funds — and there is no settlement hook (`SplitFullySettled` at line 300 is
 *    only an event), so someone still has to send another transaction.
 *
 *  - **Merchant-as-creator** (McFair calls `createSplit`, so `s.creator` is the
 *    merchant and `paySplit` pays it directly). Works mechanically, since
 *    `s.creator = msg.sender` at line 224 and there is no setter. Rejected on
 *    operational cost: it requires a funded server-side hot wallet, introduces a
 *    liveness dependency where merchant downtime blocks all ordering, and costs
 *    0.30% of every share. Gas itself was never the objection — measured
 *    345,972 gas for 3 participants, about one cent on Base.
 *
 * DELIBERATE DIVERGENCE — remainder handling. FairsplitV2 gives the
 * integer-division remainder to whoever pays *last*
 * (`getParticipantAmount`, line 483: the final unpaid participant is charged
 * `totalAmount - totalPaid`). FairEats instead assigns it to
 * `participants[0]`, the payer placing the order. This is not a bug and not an
 * oversight: with no on-chain split object there is no contract to arbitrate
 * who pays last, and the off-chain ledger has to reconcile exactly to the
 * total or settlement can never be confirmed. The amount at stake is at most
 * `participants.length - 1` micro-USDC — under a hundredth of a cent. Do not
 * "fix" this to match the contract; the two models are solving different
 * problems.
 *
 * SCOPE: this model is FairEats-only, and is sound here *because the merchant is
 * a known fixed recipient*. The rest of Fairsplit keeps using
 * `createSplit`/`paySplit`, where the recipient is another user rather than a
 * registered payee. Do not generalise this to those paths.
 * ---------------------------------------------------------------------------
 */

import { MAX_SPLIT_PARTICIPANTS } from "./config";
import { formatMicro, splitPlanForEqual } from "./pricing";

export type ShareLedgerEntry = {
  address: string;
  shareMicro: bigint;
  /** True for the participant carrying the integer-division remainder. */
  carriesRemainder: boolean;
};

export type ShareLedger = {
  entries: ShareLedgerEntry[];
  totalMicro: bigint;
};

/**
 * Builds the authoritative per-participant ledger for an equally split order.
 *
 * Share arithmetic is the floor division from `splitPlanForEqual`, which
 * mirrors `FairsplitV2.getParticipantAmount`. The difference here is that this
 * ledger is authoritative rather than advisory: there is no contract to hand
 * the remainder to whoever pays last, so the remainder is assigned
 * deterministically to `participants[0]` — by convention the payer, the person
 * placing the order. The result always reconciles exactly to the total, which
 * is what lets `isSettled` compare sums without a tolerance.
 *
 * The remainder is at most `participants.length - 1` micro-USDC, so under a
 * hundredth of a cent; the point is exactness, not fairness.
 */
export function buildEqualShareLedger(
  participants: string[],
  totalMicro: bigint,
): ShareLedger {
  assertParticipantCap(participants.length);
  const plan = splitPlanForEqual(participants, totalMicro);

  const entries = plan.displayShares.map((share, index) => ({
    address: share.address.toLowerCase(),
    shareMicro:
      index === 0 ? share.shareMicro + plan.remainderMicro : share.shareMicro,
    carriesRemainder: index === 0 && plan.remainderMicro > BigInt(0),
  }));

  assertReconciles(entries, totalMicro);
  return { entries, totalMicro };
}

/**
 * Ledger from explicit per-participant amounts, for per-item attribution.
 * Must reconcile exactly; there is no remainder to absorb.
 */
export function buildFixedShareLedger(
  shares: { address: string; shareMicro: bigint }[],
  totalMicro: bigint,
): ShareLedger {
  assertParticipantCap(shares.length);
  if (shares.some((share) => share.shareMicro <= BigInt(0))) {
    throw new Error("Every participant must owe more than zero.");
  }
  const entries = shares.map((share) => ({
    address: share.address.toLowerCase(),
    shareMicro: share.shareMicro,
    carriesRemainder: false,
  }));
  assertReconciles(entries, totalMicro);
  return { entries, totalMicro };
}

/**
 * The cap is a product limit here, not a contract one: `directPay` has no
 * participant ceiling, unlike `createSplit`'s MAX_PARTICIPANTS. Kept anyway —
 * a twenty-way split at a restaurant table is already past the point of being
 * a good experience.
 */
function assertParticipantCap(count: number): void {
  if (count > MAX_SPLIT_PARTICIPANTS) {
    throw new Error(
      `Up to ${MAX_SPLIT_PARTICIPANTS} people can split one order. Remove someone to continue.`,
    );
  }
}

function assertReconciles(
  entries: { shareMicro: bigint }[],
  totalMicro: bigint,
): void {
  const sum = entries.reduce((acc, entry) => acc + entry.shareMicro, BigInt(0));
  if (sum !== totalMicro) {
    throw new Error(
      `Shares add up to ${formatMicro(sum)} but the order total is ${formatMicro(
        totalMicro,
      )}.`,
    );
  }
}

export type SettlementProgress = {
  totalMicro: bigint;
  /** Sum of shares whose payment has been confirmed against the chain. */
  confirmedMicro: bigint;
  outstandingMicro: bigint;
  paidCount: number;
  participantCount: number;
  isSettled: boolean;
};

/**
 * Settlement status for the merchant dashboard.
 *
 * `confirmed` must mean "verified against the chain", never "the client said
 * it paid" — with no on-chain split object there is nothing else enforcing the
 * total, so a forged claim would otherwise mark an unpaid order settled.
 */
export function settlementProgress(
  entries: { shareMicro: bigint; status: "pending" | "paid" }[],
  totalMicro: bigint,
): SettlementProgress {
  const confirmedMicro = entries
    .filter((entry) => entry.status === "paid")
    .reduce((sum, entry) => sum + entry.shareMicro, BigInt(0));
  return {
    totalMicro,
    confirmedMicro,
    outstandingMicro: totalMicro - confirmedMicro,
    paidCount: entries.filter((entry) => entry.status === "paid").length,
    participantCount: entries.length,
    isSettled: confirmedMicro === totalMicro && entries.length > 0,
  };
}

/**
 * DESIGN NOTE — pay-alone-then-split (not built yet).
 *
 * When the payer has already settled the full total via `directPay`, a later
 * split cannot route money to the merchant: the merchant has been paid. It
 * becomes a FairEats-internal reimbursement ledger between the payer and the
 * participants, which is a different object from an order ledger:
 *
 *  - The payer's order stays `settled`; nothing about it changes.
 *  - A reimbursement ledger is created with the payer as creditor and the
 *    participants as debtors, shares derived the same way as above.
 *  - **DECIDED: this path uses `createSplit`/`paySplit`, not `directPay`.**
 *    Reimbursement is strictly user-to-user with no fixed known recipient,
 *    which is precisely what `paySplit` routing to `s.creator` exists for: the
 *    payer creates the split, so every participant's share settles to the
 *    payer automatically, with the contract tracking who has paid. Using
 *    `directPay` here for symmetry with the order path would be wrong — it
 *    would discard the on-chain ledger in the one case where there is no fixed
 *    payee to justify doing so.
 *  - The payer must be excluded from the participant list: `createSplit` does
 *    not add `msg.sender` (line 232 iterates only the passed array), and a
 *    self-included creator would transfer to themselves and burn the fee.
 *  - This path therefore *does* pay the 0.30% `paySplit` fee, unlike the order
 *    path. That is the correct trade for getting on-chain settlement tracking
 *    on a user-to-user debt.
 *
 * Do not build this until the main per-participant path works end to end.
 */
export const PAY_ALONE_THEN_SPLIT_DESIGNED_NOT_BUILT = true;
