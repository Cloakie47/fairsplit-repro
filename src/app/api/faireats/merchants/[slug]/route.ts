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
    // Never surface the raw error: a cold Supabase connection throws
    // "TypeError: fetch failed", which is meaningless to a diner. Log the
    // real cause server-side; the client retries 5xx before showing this.
    console.error("[faireats] storefront", e);
    return NextResponse.json(
      { error: "Could not load this business right now." },
      { status: 503 },
    );
  }
}
