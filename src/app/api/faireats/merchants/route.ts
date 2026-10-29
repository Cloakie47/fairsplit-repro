import { NextResponse } from "next/server";

import { listMerchants } from "@/lib/faireats/db";

export const dynamic = "force-dynamic";

/** Public: the Businesses list. Contains no customer data. */
export async function GET() {
  try {
    const merchants = await listMerchants();
    return NextResponse.json({ merchants });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load merchants";
    // Supabase unconfigured or unreachable: report it rather than returning an
    // empty list, which would render as "no businesses" and hide the outage.
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
