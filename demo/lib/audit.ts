/**
 * Every write the demo makes to its compliance tables goes through here, so
 * there is exactly one place where an auditor can see what gets recorded.
 *
 * The rule the whole design rests on: detail carries codes, never free text
 * and never a patient identifier. patient_ref is a salted hash.
 */

import { q } from "./db";

export type PipelineStatus = "running" | "ok" | "warn" | "error";

/** Fixed step order, so the pipeline panel can render a stable ladder. */
export const PIPELINE_STEPS = [
  "signature_verified",
  "patient_matched",
  "slots_checked",
  "appointment_written",
  "audit_logged",
  "consent_recorded",
  "reminder_queued",
] as const;

export type PipelineStep = (typeof PIPELINE_STEPS)[number];

export async function logPipeline(
  callId: string,
  step: PipelineStep | string,
  status: PipelineStatus,
  detail?: string,
  durationMs?: number,
): Promise<void> {
  await q(
    `insert into pipeline_events (call_id, step, status, detail, duration_ms)
     values ($1,$2,$3,$4,$5)`,
    [callId, step, status, detail ?? null, durationMs ?? null],
  );
}

export async function logAccess(input: {
  actor: string;
  action: string;
  callId?: string | null;
  patientRef?: string | null;
  appointmentRef?: string | null;
  location?: string | null;
  outcome: string;
  detail?: Record<string, unknown> | null;
}): Promise<void> {
  await q(
    `insert into phi_access_log
       (actor, action, call_id, patient_ref, appointment_ref, location, outcome, detail)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      input.actor,
      input.action,
      input.callId ?? null,
      input.patientRef ?? null,
      input.appointmentRef ?? null,
      input.location ?? null,
      input.outcome,
      input.detail ? JSON.stringify(input.detail) : null,
    ],
  );
}

export type ConsentKind =
  | "recording_notice"
  | "ai_disclosure"
  | "sms_opt_in"
  | "sms_opt_out"
  | "call_opt_out";

export async function logConsent(input: {
  callId: string;
  phoneHash: string;
  phoneLast4: string;
  kind: ConsentKind;
  scriptVer?: string;
  channel?: "voice" | "sms";
}): Promise<void> {
  await q(
    `insert into consent_events (call_id, phone_hash, phone_last4, kind, script_ver, channel)
     values ($1,$2,$3,$4,$5,$6)`,
    [
      input.callId,
      input.phoneHash,
      input.phoneLast4,
      input.kind,
      input.scriptVer ?? "v1.0",
      input.channel ?? "voice",
    ],
  );
}

export async function queueRequest(input: {
  callId: string;
  patientRef?: string | null;
  location: string;
  reason: string;
  requested: Record<string, unknown>;
}): Promise<number> {
  const rows = await q<{ id: number }>(
    `insert into booking_queue (call_id, patient_ref, location, reason, requested)
     values ($1,$2,$3,$4,$5) returning id`,
    [input.callId, input.patientRef ?? null, input.location, input.reason, JSON.stringify(input.requested)],
  );
  return rows[0]?.id ?? 0;
}

/** Opens (or refreshes) the row that tracks a call for the demo dashboard. */
export async function touchCall(callId: string, channel: "web" | "phone" = "web"): Promise<void> {
  await q(
    `insert into demo_calls (call_id, channel) values ($1,$2)
     on conflict (call_id) do nothing`,
    [callId, channel],
  );
}

export async function flagCall(callId: string, summary: string): Promise<void> {
  await q(
    `update demo_calls set flagged = true, summary = coalesce(summary, $2) where call_id = $1`,
    [callId, summary],
  );
}

export async function closeCall(callId: string, outcome: string, summary?: string): Promise<void> {
  await q(
    `update demo_calls set ended_at = now(), outcome = $2, summary = coalesce($3, summary)
     where call_id = $1`,
    [callId, outcome, summary ?? null],
  );
}
