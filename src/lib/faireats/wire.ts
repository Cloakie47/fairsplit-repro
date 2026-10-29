/**
 * Wire shapes for the `/api/faireats/*` routes.
 *
 * JSON has no bigint, so every micro-USDC value crosses the boundary as a
 * decimal string and is converted back with BigInt() on the client. Doing this
 * explicitly in one place keeps a `Number()` from sneaking into a money path.
 */

import {
  readWalletSessionFromToken,
  WALLET_SESSION_COOKIE,
} from "@/lib/wallet-session";
import type { FairEatsTable, Merchant, MenuItem } from "./types";

export type WireMerchant = Omit<Merchant, never>;

export type WireMenuOption = {
  id: string;
  name: string;
  priceDeltaMicro: string;
  isDefault: boolean;
  isAvailable: boolean;
};

export type WireMenuGroup = {
  id: string;
  name: string;
  kind: string;
  minSelect: number;
  maxSelect?: number;
  options: WireMenuOption[];
};

export type WireMenuItem = Omit<MenuItem, "basePriceMicro" | "groups"> & {
  basePriceMicro: string;
  groups: WireMenuGroup[];
};

export function menuItemToWire(item: MenuItem): WireMenuItem {
  return {
    ...item,
    basePriceMicro: item.basePriceMicro.toString(),
    groups: item.groups.map((group) => ({
      id: group.id,
      name: group.name,
      kind: group.kind,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      options: group.options.map((option) => ({
        id: option.id,
        name: option.name,
        priceDeltaMicro: option.priceDeltaMicro.toString(),
        isDefault: option.isDefault,
        isAvailable: option.isAvailable,
      })),
    })),
  };
}

export function menuItemFromWire(item: WireMenuItem): MenuItem {
  return {
    ...item,
    basePriceMicro: BigInt(item.basePriceMicro),
    groups: item.groups.map((group) => ({
      id: group.id,
      name: group.name,
      kind: group.kind === "multi" ? "multi" : "single",
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      options: group.options.map((option) => ({
        id: option.id,
        name: option.name,
        priceDeltaMicro: BigInt(option.priceDeltaMicro),
        isDefault: option.isDefault,
        isAvailable: option.isAvailable,
      })),
    })),
  };
}

/** Tables carry no bigint; re-exported for symmetry at the call sites. */
export type WireTable = FairEatsTable;

/**
 * Reads the wallet session if the caller happens to have one, without
 * rejecting anonymous callers. Storefront reads are public — a menu and a
 * table layout are not secrets — but knowing the viewer lets us disclose a
 * table's occupant to that occupant and to the merchant owner, and to nobody
 * else.
 */
export function readOptionalWallet(request: Request): string | undefined {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey !== WALLET_SESSION_COOKIE) continue;
    const session = readWalletSessionFromToken(rest.join("="));
    return session?.walletLower;
  }
  return undefined;
}

/** Shared error shape so the client can branch on `error` without parsing prose. */
export type WireError = { error: string };
