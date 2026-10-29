import { NextResponse } from "next/server";

import { getMenu, getMerchantBySlug } from "@/lib/faireats/db";
import { menuItemToWire } from "@/lib/faireats/wire";

export const dynamic = "force-dynamic";

/** Public: one storefront — merchant record plus its full menu. */
export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  const slug = (params.slug ?? "").trim().toLowerCase();
  if (!slug) {
    return NextResponse.json({ error: "Missing merchant" }, { status: 400 });
  }

  try {
    const merchant = await getMerchantBySlug(slug);
    if (!merchant) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    }
    const menu = await getMenu(merchant.id);
    return NextResponse.json({
      merchant,
      menu: menu.map(menuItemToWire),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load merchant";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
