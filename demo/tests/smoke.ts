/**
 * End to end check of the pipeline without Next.js, Retell or a database
 * server. Runs against PGlite, the embedded Postgres, so it works on a clean
 * machine with no accounts.
 *
 *   npx tsx tests/smoke.ts
 *
 * It books an appointment the way a real call would and then prints the audit
 * and pipeline rows that the demo screen renders.
 */

import { rm } from "node:fs/promises";
import { q, resetDemo } from "../lib/db";
import { runTool } from "../lib/tools";
import type { ToolRequest } from "../lib/retell";

const CALL_ID = "call_smoke_001";

function call(name: string, args: Record<string, unknown>): ToolRequest {
  return { name, call: { call_id: CALL_ID }, args };
}

function heading(text: string) {
  console.log(`\n=== ${text} ===`);
}

async function main() {
  // Start from a clean store so the run is repeatable.
  await rm(process.env.PGLITE_DIR || "./.pgdata", { recursive: true, force: true });

  heading("seed");
  await resetDemo();
  const [{ patients, appointments }] = await q<{ patients: number; appointments: number }>(
    `select (select count(*)::int from demo_patients) as patients,
            (select count(*)::int from demo_appointments) as appointments`,
  );
  console.log(`patients ${patients}, seeded appointments ${appointments}`);
  if (patients === 0 || appointments === 0) throw new Error("seed produced no data");

  heading("find_patient, known patient");
  const found = (await runTool(
    call("find_patient", { first_name: "Sarah", last_name: "Whitfield", date_of_birth: "1986-04-12" }),
  )) as { status: string; patient_id?: string; first_name?: string };
  console.log(found);
  if (found.status !== "found" || !found.patient_id) throw new Error("expected to find the seeded patient");
  if ("phone" in found || "last_name" in found) throw new Error("tool leaked a field it should not return");

  heading("find_patient, wrong date of birth");
  const missing = await runTool(
    call("find_patient", { first_name: "Sarah", last_name: "Whitfield", date_of_birth: "1990-01-01" }),
  );
  console.log(missing);
  if ((missing as { status: string }).status !== "not_found") throw new Error("expected not_found");

  heading("get_slots");
  const slots = (await runTool(
    call("get_slots", { location: "downtown", appointment_type: "hygiene", time_preference: "morning" }),
  )) as { slots?: { id: string; say: string }[]; status?: string };
  console.log(slots.slots?.map((s) => s.say) ?? slots);
  if (!slots.slots?.length) throw new Error("expected at least one open slot");
  if (slots.slots.length > 3) throw new Error("agent should never be offered more than three slots");

  heading("book_appointment");
  const booked = (await runTool(
    call("book_appointment", { patient_id: found.patient_id, slot_id: slots.slots[0].id }),
  )) as { status: string; say?: string; appointment_id?: string };
  console.log(booked);
  if (booked.status !== "booked") throw new Error(`expected booked, got ${booked.status}`);

  heading("double booking the same slot falls back to the queue");
  const clash = (await runTool(
    call("book_appointment", { patient_id: "pat_002", slot_id: slots.slots[0].id }),
  )) as { status: string };
  console.log(clash);
  if (clash.status !== "queued") throw new Error("a taken slot should queue for the front desk");

  heading("record_sms_opt_in");
  console.log(await runTool(call("record_sms_opt_in", { opted_in: true })));

  heading("appointment landed on the schedule");
  const rows = await q<{ id: string; created_by: string; starts_at: string; status: string }>(
    `select id, created_by, starts_at, status from demo_appointments
     where created_by = 'ai_agent' order by created_at desc`,
  );
  console.log(rows);
  if (rows.length !== 1) throw new Error(`expected exactly one AI booking, found ${rows.length}`);

  heading("pipeline steps the demo will light up");
  const pipeline = await q<{ step: string; status: string; detail: string | null }>(
    `select step, status, detail from pipeline_events where call_id = $1 order by id asc`,
    [CALL_ID],
  );
  for (const p of pipeline) console.log(`  ${p.status.padEnd(7)} ${p.step.padEnd(22)} ${p.detail ?? ""}`);

  heading("audit rows");
  const audit = await q<{ actor: string; action: string; outcome: string; patient_ref: string | null }>(
    `select actor, action, outcome, patient_ref from phi_access_log order by id asc`,
  );
  for (const a of audit) {
    console.log(`  ${a.actor.padEnd(14)} ${a.action.padEnd(22)} ${a.outcome.padEnd(10)} ${a.patient_ref ?? "-"}`);
  }

  heading("no raw patient identifier is stored in the audit log");
  const leaked = await q<{ n: number }>(
    `select count(*)::int as n from phi_access_log
     where patient_ref is not null and patient_ref like 'pat\\_%'`,
  );
  console.log(`rows containing a raw patient id: ${leaked[0].n}`);
  if (leaked[0].n > 0) throw new Error("audit log must store a hash, not the patient id");

  heading("consent rows");
  console.log(await q(`select kind, script_ver, phone_last4 from consent_events order by id asc`));

  heading("a caller who is not on file is set up and can book on the same call, and is found next time");
  const miss = (await runTool(call("find_patient", { first_name: "Jessica", last_name: "Moore", date_of_birth: "March 3rd 1990" }))) as { status: string };
  if (miss.status !== "not_found") throw new Error("Jessica is not seeded and must not be found");
  const made = (await runTool(call("create_patient", { first_name: "Jessica", last_name: "Moore", date_of_birth: "March 3rd 1990", location: "Downtown" }))) as { status: string; patient_id: string; first_name: string };
  console.log("created:", made.status, made.first_name);
  if (made.status !== "created") throw new Error(`create_patient must create, got ${made.status}`);
  const again = (await runTool(call("find_patient", { first_name: "Jessica Moore", last_name: "", date_of_birth: "3/3/1990" }))) as { status: string; patient_id: string };
  if (again.status !== "found" || again.patient_id !== made.patient_id) throw new Error("a patient created on one call must be found on the next");
  const slots2 = (await runTool(call("get_slots", { location: "downtown", appointment_type: "hygiene", time_preference: "any", provider: "any" }))) as { slots?: { id: string }[] };
  if (!slots2.slots?.length) throw new Error("a new patient must be offered slots");
  const booked2 = (await runTool(call("book_appointment", { patient_id: made.patient_id, slot_id: slots2.slots[0].id }))) as { status: string };
  if (booked2.status !== "booked") throw new Error(`a new patient must be able to book, got ${booked2.status}`);
  const second = (await runTool(call("create_patient", { first_name: "Owen", last_name: "Marsh", date_of_birth: "1 Feb 1985", location: "northside" }))) as { patient_id: string };
  if (second.patient_id === made.patient_id) throw new Error("two new patients must not share a record");

  console.log("\nAll checks passed.\n");
}

main().catch((err) => {
  console.error("\nSMOKE TEST FAILED\n", err);
  process.exit(1);
});
