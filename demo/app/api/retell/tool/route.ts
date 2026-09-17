/**
 * The endpoint Retell calls when the agent uses one of its tools.
 *
 * This is the pipeline entry point. It verifies the signature before touching
 * anything, records the verification as the first pipeline step so the client
 * can see it happen, then dispatches to the handler.
 */

import { NextRequest, NextResponse } from "next/server";
import { logPipeline, touchCall } from "@/lib/audit";
import { databaseWarning } from "@/lib/db";
import { signatureRequired, verifyRetellSignature, type ToolRequest } from "@/lib/retell";
import { runTool } from "@/lib/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    return await handle(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    // Retell may read this aloud in the worst case, so keep it short and calm.
    return NextResponse.json(
      { status: "error", say: "I could not reach the schedule just now", detail: message, hint: databaseWarning() },
      { status: 200 },
    );
  }
}

async function handle(request: NextRequest) {
  const startedAt = Date.now();

  // Raw body first: the signature is computed over the exact bytes.
  const rawBody = await request.text();

  let payload: ToolRequest;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "body is not valid JSON" }, { status: 400 });
  }

  const callId = payload?.call?.call_id;
  if (!callId || !payload?.name) {
    return NextResponse.json({ error: "expected name and call.call_id" }, { status: 400 });
  }

  const check = verifyRetellSignature(
    rawBody,
    request.headers.get("x-retell-signature"),
    process.env.RETELL_API_KEY,
  );

  if (!check.ok) {
    if (signatureRequired()) {
      await touchCall(callId);
      await logPipeline(callId, "signature_verified", "error", check.reason);
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
    await touchCall(callId);
    await logPipeline(callId, "signature_verified", "warn", `unsigned, allowed by demo setting: ${check.reason}`);
  } else {
    await touchCall(callId);
    await logPipeline(callId, "signature_verified", "ok", `HMAC SHA256 matched, ${check.ageMs} ms old`, Date.now() - startedAt);
  }

  const result = await runTool(payload);
  return NextResponse.json(result);
}

/** Lets you confirm the endpoint is reachable from a browser. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "retell custom function webhook",
    signature_required: signatureRequired(),
  });
}
