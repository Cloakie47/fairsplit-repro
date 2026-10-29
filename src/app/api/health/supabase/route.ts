import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/health/supabase
 * - Verifies public env vars.
 * - If SUPABASE_SERVICE_ROLE_KEY is set and migrations ran, checks DB connectivity via `profiles`.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
      },
      { status: 503 }
    );
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({
      ok: true,
      configured: true,
      database: "skipped",
      hint:
        "Set SUPABASE_SERVICE_ROLE_KEY to verify the database (and run supabase/migrations SQL in the dashboard).",
    });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .select("wallet_address")
      .limit(1);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          hint:
            "Run supabase/migrations/001_initial_schema.sql in Supabase → SQL Editor.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      database: "reachable",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 503 }
    );
  }
}
