/**
 * Rebuilds the demo practice from the command line.
 *
 *   npm run seed
 *
 * Useful before a demo, or after editing lib/config.ts. Against a real
 * DATABASE_URL this reseeds that database; with no DATABASE_URL it rebuilds
 * the local PGlite store.
 */

import { q, resetDemo } from "./db";

async function main() {
  const target = process.env.DATABASE_URL ? "the configured Postgres database" : "the local PGlite store";
  console.log(`Reseeding ${target}...`);

  await resetDemo();

  const [counts] = await q<{ patients: number; appointments: number }>(
    `select (select count(*)::int from demo_patients)    as patients,
            (select count(*)::int from demo_appointments) as appointments`,
  );

  console.log(`Done. ${counts.patients} patients, ${counts.appointments} appointments.`);
  console.log("Compliance tables are empty and ready for a fresh call.");
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
