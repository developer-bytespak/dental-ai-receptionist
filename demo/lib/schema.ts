/**
 * Demo database schema.
 *
 * The four compliance tables (phi_access_log, consent_events, booking_queue,
 * suppression_list) are the same shape as the production build in db/*.sql, so
 * what the client sees in the demo is what ships. The practice tables stand in
 * for Dentrix, which we cannot reach in a demo.
 *
 * Kept as a TypeScript string rather than a .sql file so it is bundled into
 * serverless functions without any file-system access at runtime.
 */

export const SCHEMA_SQL = `
-- ---------- stand-in for the practice management system ----------

create table if not exists demo_patients (
  id            text primary key,
  first_name    text not null,
  last_name     text not null,
  date_of_birth date not null,
  phone         text not null,
  location_id   text not null
);

create table if not exists demo_appointments (
  id             text primary key,
  patient_id     text references demo_patients(id),
  provider_id    text not null,
  operatory_id   text not null,
  location_id    text not null,
  type_id        text not null,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  status         text not null default 'booked',   -- booked, cancelled, confirmed
  created_by     text not null default 'front_desk', -- front_desk or ai_agent
  call_id        text,
  created_at     timestamptz not null default now()
);
create index if not exists demo_appointments_starts_at on demo_appointments (starts_at);

-- ---------- compliance tables, same shape as production ----------

create table if not exists phi_access_log (
  id              bigserial primary key,
  occurred_at     timestamptz not null default now(),
  actor           text not null,
  action          text not null,
  call_id         text,
  patient_ref     text,
  appointment_ref text,
  location        text,
  outcome         text not null,
  detail          jsonb
);
create index if not exists phi_access_log_occurred_at on phi_access_log (occurred_at);
create index if not exists phi_access_log_call_id on phi_access_log (call_id);

create table if not exists consent_events (
  id          bigserial primary key,
  occurred_at timestamptz not null default now(),
  call_id     text not null,
  phone_hash  text not null,
  phone_last4 text not null,
  kind        text not null,
  script_ver  text not null,
  channel     text not null
);
create index if not exists consent_events_call_id on consent_events (call_id);

create table if not exists booking_queue (
  id           bigserial primary key,
  created_at   timestamptz not null default now(),
  call_id      text not null,
  patient_ref  text,
  location     text not null,
  reason       text not null,
  requested    jsonb not null,
  fulfilled_at timestamptz,
  fulfilled_by text
);

create table if not exists suppression_list (
  phone_hash text primary key,
  added_at   timestamptz not null default now(),
  source     text not null
);

-- ---------- demo-only: drives the live pipeline panel ----------

create table if not exists pipeline_events (
  id          bigserial primary key,
  occurred_at timestamptz not null default now(),
  call_id     text not null,
  step        text not null,
  status      text not null,          -- running, ok, warn, error
  detail      text,
  duration_ms integer
);
create index if not exists pipeline_events_call_id on pipeline_events (call_id);

create table if not exists demo_calls (
  call_id     text primary key,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  channel     text not null default 'web',   -- web or phone
  outcome     text,
  flagged     boolean not null default false,
  summary     text
);
`;

/** Wipes everything the demo writes, leaving the schema in place. */
export const TRUNCATE_SQL = `
truncate table pipeline_events, phi_access_log, consent_events,
               booking_queue, suppression_list, demo_calls,
               demo_appointments, demo_patients restart identity cascade;
`;
