/**
 * FairEats domain types.
 *
 * These mirror `supabase/migrations/002_faireats.sql`. Money fields are bigint
 * micro-USDC in the app and plain integers over the wire (JSON has no bigint),
 * so the API boundary serialises them as strings — see `serializeMicro`.
 */

export type TableStatus = "available" | "occupied";

export type OrderStatus =
  | "draft"
  | "awaiting_payment"
  | "paid"
  | "splitting"
  | "settled"
  | "cancelled";

export type PaymentMode = "public" | "confidential";

export type SplitMode = "alone" | "participants";

export type OptionGroupKind = "single" | "multi";

export type ParticipantStatus = "pending" | "paid";

export type Merchant = {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  logoPath?: string;
  coverPath?: string;
  ownerAddress: string;
  payoutAddress: string;
  confidentialReady: boolean;
  isOpen: boolean;
  createdAt: number;
};

export type FairEatsTable = {
  id: string;
  merchantId: string;
  tableCode: string;
  seats?: number;
  status: TableStatus;
  /**
   * Only ever sent to the merchant owner or to the occupant themselves. Other
   * customers see an occupied table with no address attached.
   */
  occupantAddress?: string;
  lockedAt?: number;
  /** True when lockedAt is older than TABLE_LOCK_TIMEOUT_MS. */
  isStale?: boolean;
};

export type MenuOption = {
  id: string;
  name: string;
  priceDeltaMicro: bigint;
  isDefault: boolean;
  isAvailable: boolean;
};

export type MenuOptionGroup = {
  id: string;
  name: string;
  kind: OptionGroupKind;
  minSelect: number;
  maxSelect?: number;
  options: MenuOption[];
};

export type MenuItem = {
  id: string;
  merchantId: string;
  name: string;
  description?: string;
  category: string;
  basePriceMicro: bigint;
  imagePath?: string;
  isAvailable: boolean;
  groups: MenuOptionGroup[];
};

/** One chosen option, flattened for snapshots and display. */
export type SelectedOption = {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDeltaMicro: bigint;
};

/** A cart line before it becomes an order item. */
export type CartLine = {
  /** Stable client-side id; distinct configurations of one item are separate lines. */
  lineId: string;
  menuItemId: string;
  name: string;
  imagePath?: string;
  basePriceMicro: bigint;
  selected: SelectedOption[];
  quantity: number;
};

export type OrderItem = {
  id: string;
  menuItemId?: string;
  nameSnapshot: string;
  unitPriceMicro: bigint;
  quantity: number;
  lineTotalMicro: bigint;
  optionsSnapshot: SelectedOption[];
};

export type OrderParticipant = {
  id: string;
  participantAddress: string;
  shareMicro: bigint;
  status: ParticipantStatus;
  paidAt?: number;
};

export type Order = {
  id: string;
  merchantId: string;
  tableId?: string;
  tableCodeSnapshot?: string;
  payerAddress: string;
  subtotalMicro: bigint;
  totalMicro: bigint;
  status: OrderStatus;
  paymentMode: PaymentMode;
  splitMode: SplitMode;
  chainId: number;
  /** FairsplitV2 splitId once the order has been split. */
  splitId?: string;
  txHash?: string;
  createdAt: number;
  paidAt?: number;
  settledAt?: number;
  items: OrderItem[];
  participants: OrderParticipant[];
};

/** JSON-safe money: bigint does not survive JSON.stringify. */
export function serializeMicro(value: bigint): string {
  return value.toString();
}

export function deserializeMicro(value: string | number | bigint): bigint {
  return BigInt(value);
}
