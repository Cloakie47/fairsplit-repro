import { NextResponse } from "next/server";

import { listMerchants } from "@/lib/faireats/db";

export const dynamic = "force-dynamic";

/** Public: the Businesses list. Contains no customer data. */
export async function GET() {
  try {
    const merchants = await listMerchants();
    return NextResponse.json({ merchants });
  } catch (e) {
    // Report the outage rather than returning an empty list, which would
    // render as "no businesses" and hide the problem. But never surface the
    // raw error: a cold Supabase connection throws "TypeError: fetch failed",
    // which means nothing to a diner. The client retries 5xx before showing
    // this message.
    console.error("[faireats] merchants", e);
    return NextResponse.json(
      { error: "Could not load businesses right now." },
      { status: 503 },
    );
  }
}
