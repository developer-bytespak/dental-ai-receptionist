/**
 * Seeds a believable practice day.
 *
 * Every patient here is invented. Nothing in this file is real patient data,
 * and the demo never touches a real practice management system.
 *
 * The schedule is deliberately busy but not full: each provider keeps a few
 * open slots in the next two weeks so the AI always has something to offer.
 */

import { raw } from "./db";
import {
  APPOINTMENT_TYPES,
  DAY_END_HOUR,
  DAY_START_HOUR,
  OPERATORIES,
  PROVIDERS,
  SLOT_MINUTES,
} from "./config";

/** Invented patients. The demo caller is the first one. */
export const DEMO_PATIENTS = [
  // The name and date of birth to read out during the demo.
  { id: "pat_001", first: "Sarah", last: "Whitfield", dob: "1986-04-12", phone: "+15550143311", loc: "downtown" },
  { id: "pat_002", first: "Marcus", last: "Delgado", dob: "1974-11-30", phone: "+15550143312", loc: "downtown" },
  { id: "pat_003", first: "Priya", last: "Raman", dob: "1992-02-08", phone: "+15550143313", loc: "downtown" },
  { id: "pat_004", first: "Tom", last: "Brennan", dob: "1968-07-21", phone: "+15550143314", loc: "northside" },
  { id: "pat_005", first: "Alice", last: "Nakamura", dob: "1999-09-03", phone: "+15550143315", loc: "northside" },
  { id: "pat_006", first: "Desmond", last: "Clarke", dob: "1981-01-17", phone: "+15550143316", loc: "downtown" },
  { id: "pat_007", first: "Helen", last: "Vasquez", dob: "1955-05-29", phone: "+15550143317", loc: "downtown" },
  { id: "pat_008", first: "Jonah", last: "Bright", dob: "2001-12-11", phone: "+15550143318", loc: "northside" },
];

/** Start of today in the practice timezone, normalised to the hour. */
export function dayStart(offsetDays = 0): Date {
  const d = new Date();
  d.setHours(DAY_START_HOUR, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

function at(offsetDays: number, hour: number, minute: number): Date {
  const d = dayStart(offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Deterministic pseudo-random so every demo run looks the same. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

type SeedAppointment = {
  id: string;
  patientId: string;
  providerId: string;
  operatoryId: string;
  locationId: string;
  typeId: string;
  start: Date;
  minutes: number;
};

/**
 * Builds a fortnight of appointments. Weekends are skipped, roughly 55 percent
 * of each provider's day is filled, and the rest stays open for the AI to book
 * into.
 */
function buildSchedule(): SeedAppointment[] {
  const random = rng(20260915);
  const out: SeedAppointment[] = [];
  let n = 0;

  for (let day = 0; day <= 14; day++) {
    const date = dayStart(day);
    const weekday = date.getDay();
    if (weekday === 0 || weekday === 6) continue;

    for (const provider of PROVIDERS) {
      const ops = OPERATORIES.filter((o) => o.locationId === provider.locationId);
      const types = APPOINTMENT_TYPES.filter((t) => t.providerIds.includes(provider.id));
      if (!ops.length || !types.length) continue;

      let minute = 0;
      const dayMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60;

      while (minute < dayMinutes - 30) {
        // Lunch, always blocked, keeps the grid looking like a real day.
        const clockHour = DAY_START_HOUR + Math.floor(minute / 60);
        if (clockHour === 12) {
          minute += 60;
          continue;
        }

        const fill = random() < (day === 0 ? 0.7 : 0.55);
        const type = types[Math.floor(random() * types.length)];

        if (fill) {
          const patient = DEMO_PATIENTS[Math.floor(random() * DEMO_PATIENTS.length)];
          const op = ops[Math.floor(random() * ops.length)];
          out.push({
            id: `apt_seed_${++n}`,
            patientId: patient.id,
            providerId: provider.id,
            operatoryId: op.id,
            locationId: provider.locationId,
            typeId: type.id,
            start: at(day, DAY_START_HOUR + Math.floor(minute / 60), minute % 60),
            minutes: type.minutes,
          });
          minute += type.minutes;
        } else {
          minute += SLOT_MINUTES;
        }
      }
    }
  }

  return out;
}

export async function seed(tenantId = "demo"): Promise<void> {
  for (const p of DEMO_PATIENTS) {
    await raw(
      `insert into demo_patients (id, first_name, last_name, date_of_birth, phone, location_id, tenant_id)
       values ($1,$2,$3,$4,$5,$6,$7) on conflict (id) do nothing`,
      [p.id, p.first, p.last, p.dob, p.phone, p.loc, tenantId],
    );
  }

  for (const a of buildSchedule()) {
    const ends = new Date(a.start.getTime() + a.minutes * 60_000);
    await raw(
      `insert into demo_appointments
         (id, patient_id, provider_id, operatory_id, location_id, type_id,
          starts_at, ends_at, status, created_by, tenant_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'booked','front_desk',$9)
       on conflict (id) do nothing`,
      [a.id, a.patientId, a.providerId, a.operatoryId, a.locationId, a.typeId, a.start.toISOString(), ends.toISOString(), tenantId],
    );
  }

  // One patient starts with an appointment to move, so the reschedule demo
  // always has a target. Sarah Whitfield, day 2, with the hygienist.
  const target = at(2, 10, 20);
  await raw(
    `insert into demo_appointments
       (id, patient_id, provider_id, operatory_id, location_id, type_id,
        starts_at, ends_at, status, created_by, tenant_id)
     values ('apt_demo_target','pat_001','prov_hayes','op_d3','downtown','hygiene',$1,$2,'booked','front_desk',$3)
     on conflict (id) do update set starts_at = excluded.starts_at, ends_at = excluded.ends_at, status = 'booked'`,
    [target.toISOString(), new Date(target.getTime() + 60 * 60_000).toISOString(), tenantId],
  );
}
