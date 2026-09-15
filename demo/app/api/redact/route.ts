/**
 * Runs the transcript through the same PII categories Retell redacts with, so
 * the demo can flip between what was said and what gets stored.
 */
import { NextRequest, NextResponse } from "next/server";
import { redactTranscript, type TranscriptTurn } from "@/lib/redact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { turns?: TranscriptTurn[] } | null;
  if (!body?.turns || !Array.isArray(body.turns)) {
    return NextResponse.json({ error: "expected { turns: [{ role, content }] }" }, { status: 400 });
  }
  const { turns, found } = redactTranscript(body.turns);
  return NextResponse.json({ turns, found });
}
