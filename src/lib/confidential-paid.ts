/**
 * Persist confidential payment status in localStorage.
 * When a user pays confidentially, the contract is never updated.
 * We store the fact locally so the UI shows "paid" correctly.
 */

const STORAGE_PREFIX = "fairysplit_confidential_paid";

function storageKey(chainId: number, billId: string, participant: string): string {
  return `${STORAGE_PREFIX}_${chainId}_${billId}_${participant.toLowerCase()}`;
}

export function markConfidentialPaid(
  chainId: number,
  billId: string,
  participant: string
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(chainId, billId, participant), "1");
  } catch {
    // Best-effort; ignore quota errors
  }
}

export function isConfidentialPaid(
  chainId: number,
  billId: string,
  participant: string
): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(storageKey(chainId, billId, participant)) === "1";
  } catch {
    return false;
  }
}
