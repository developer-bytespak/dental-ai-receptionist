/**
 * Wipes a workspace. The public demo goes back to a fresh day, and anyone
 * may do that. A practice's workspace can only be cleared by our own team
 * from the admin console, never from the practice's screen.
 */
import { NextRequest, NextResponse } from "next/server";
import { resetTenant } from "@/lib/db";
import { tenantForRequest } from "@/lib/scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const resolved = await tenantForRequest(request);
  if (resolved instanceof NextResponse) return resolved;

  if (resolved.scope === "app" && !resolved.ctx?.admin) {
    return NextResponse.json({ error: "only the platform team can clear a workspace" }, { status: 403 });
  }

  await resetTenant(resolved.tenant.id);
  return NextResponse.json({ ok: true, tenant: resolved.tenant.id, reset_at: new Date().toISOString() });
}
