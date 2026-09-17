/**
 * Everything the demo screen needs, in one poll.
 *
 * The browser asks roughly twice a second with the highest id it has already
 * seen. Rows come back only when they are new, so the panels append instead of
 * redrawing and the animations stay smooth.
 *
 * Polling rather than a socket is deliberate. It survives a serverless cold
 * start, a flaky conference network and a laptop waking from sleep, which is
 * exactly the situation a live demo runs in.
 */

import { NextRequest, NextResponse } from "next/server";
import { databaseWarning, q } from "@/lib/db";
import {
  APPOINTMENT_TYPES,
  DAY_END_HOUR,
  DAY_START_HOUR,
  LOCATIONS,
  OPERATORIES,
  PRACTICE,
  PROVIDERS,
} from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(value: string | null, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(request: NextRequest) {
  try {
    return await readState(request);
  } catch (err) {
    // A blank 500 on the endpoint that drives every panel is the worst
    // possible failure to debug during a demo, so say what went wrong.
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: "could not read the demo state", detail: message, hint: databaseWarning() },
      { status: 500 },
    );
  }
}

async function readState(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const sinceAudit = num(params.get("audit"));
  const sincePipeline = num(params.get("pipeline"));
  const sinceConsent = num(params.get("consent"));
  const sinceQueue = num(params.get("queue"));
  const locationId = params.get("location") ?? LOCATIONS[0].id;
  const dayOffset = num(params.get("day"), 0);

  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() + dayOffset);
  const to = new Date(from.getTime() + 24 * 60 * 60_000);

  const [appointments, pipeline, audit, consent, queue, calls, counts] = await Promise.all([
    q(
      `select a.id, a.provider_id, a.operatory_id, a.type_id, a.status, a.created_by,
              a.call_id, a.starts_at, a.ends_at,
              p.first_name, p.last_name
       from demo_appointments a
       left join demo_patients p on p.id = a.patient_id
       where a.location_id = $1 and a.starts_at >= $2 and a.starts_at < $3
       order by a.starts_at asc`,
      [locationId, from.toISOString(), to.toISOString()],
    ),
    q(
      `select id, occurred_at, call_id, step, status, detail, duration_ms
       from pipeline_events where id > $1 order by id asc limit 200`,
      [sincePipeline],
    ),
    q(
      `select id, occurred_at, actor, action, call_id, patient_ref,
              appointment_ref, location, outcome, detail
       from phi_access_log where id > $1 order by id asc limit 200`,
      [sinceAudit],
    ),
    q(
      `select id, occurred_at, call_id, phone_last4, kind, script_ver, channel
       from consent_events where id > $1 order by id asc limit 200`,
      [sinceConsent],
    ),
    q(
      `select id, created_at, call_id, location, reason, requested, fulfilled_at
       from booking_queue where id > $1 order by id asc limit 50`,
      [sinceQueue],
    ),
    q(
      `select call_id, started_at, ended_at, channel, outcome, flagged, summary
       from demo_calls order by started_at desc limit 10`,
    ),
    q(
      `select
         (select count(*)::int from phi_access_log)  as audit_rows,
         (select count(*)::int from consent_events)  as consent_rows,
         (select count(*)::int from booking_queue where fulfilled_at is null) as queue_open,
         (select count(*)::int from demo_appointments where created_by = 'ai_agent' and status <> 'cancelled') as ai_booked`,
    ),
  ]);

  return NextResponse.json({
    practice: {
      name: PRACTICE.name,
      shortName: PRACTICE.shortName,
      tagline: PRACTICE.tagline,
      callbackNumber: PRACTICE.callbackNumber,
    },
    grid: {
      locationId,
      dayOffset,
      date: from.toISOString(),
      startHour: DAY_START_HOUR,
      endHour: DAY_END_HOUR,
      locations: LOCATIONS.map((l) => ({ id: l.id, name: l.name, hours: l.hours })),
      providers: PROVIDERS.filter((p) => p.locationId === locationId).map((p) => ({
        id: p.id,
        name: p.name,
        title: p.title,
        tone: p.tone,
      })),
      operatories: OPERATORIES.filter((o) => o.locationId === locationId),
      types: APPOINTMENT_TYPES.map((t) => ({ id: t.id, name: t.name, minutes: t.minutes })),
    },
    appointments,
    pipeline,
    audit,
    consent,
    queue,
    calls,
    counts: counts[0] ?? { audit_rows: 0, consent_rows: 0, queue_open: 0, ai_booked: 0 },
    cursors: {
      pipeline: pipeline.length ? Number(pipeline[pipeline.length - 1].id) : sincePipeline,
      audit: audit.length ? Number(audit[audit.length - 1].id) : sinceAudit,
      consent: consent.length ? Number(consent[consent.length - 1].id) : sinceConsent,
      queue: queue.length ? Number(queue[queue.length - 1].id) : sinceQueue,
    },
  });
}
