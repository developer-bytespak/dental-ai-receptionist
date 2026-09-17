/**
 * Public demo configuration. The Retell public key is designed to be visible
 * in the browser; the API key never leaves the server.
 */
import { NextResponse } from "next/server";
import { LOCATIONS, PRACTICE } from "@/lib/config";
import { connectionSource, databaseMode, databaseWarning } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    practice: PRACTICE,
    locations: LOCATIONS,
    database: { mode: databaseMode(), source: connectionSource(), warning: databaseWarning() },
    retell: {
      publicKey: process.env.NEXT_PUBLIC_RETELL_PUBLIC_KEY ?? "",
      agentId: process.env.NEXT_PUBLIC_RETELL_AGENT_ID ?? "",
      phoneNumber: process.env.NEXT_PUBLIC_DEMO_PHONE_NUMBER ?? "",
      configured: Boolean(
        process.env.NEXT_PUBLIC_RETELL_PUBLIC_KEY && process.env.NEXT_PUBLIC_RETELL_AGENT_ID,
      ),
    },
  });
}
