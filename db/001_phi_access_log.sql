-- 001_phi_access_log.sql
-- Audit log of every access to, or action on, patient-related data.
-- One row per tool call, per call end, per staff view/export/delete, per reminder contact.
-- Retention: 6 years (docs/retention-policy.md). Rows are never updated or deleted by n8n.
-- Apply to the "receptionist" database. Idempotent.

begin;

create table if not exists phi_access_log (
  id              bigserial primary key,
  occurred_at     timestamptz not null default now(),
  actor           text        not null,
  action          text        not null,
  call_id         text,
  patient_ref     text,
  appointment_ref text,
  location        text,
  outcome         text        not null,
  detail          jsonb,
  -- Tool rows use ok/not_found/error/denied/queued.
  -- call_ended rows use the Retell post-call analysis outcome (PLAN.md section 6, workflow 08).
  constraint phi_access_log_outcome_chk
    check (outcome in ('ok', 'not_found', 'error', 'denied', 'queued',
                       'booked', 'rescheduled', 'cancelled', 'confirmed',
                       'transferred', 'info_only', 'voicemail')),
  constraint phi_access_log_location_chk
    check (location is null or location in ('downtown', 'northside'))
);

comment on table  phi_access_log is
  'Audit trail of PHI access and scheduling actions. Append-only. Kept 6 years.';
comment on column phi_access_log.id is
  'Surrogate key.';
comment on column phi_access_log.occurred_at is
  'When the action happened (UTC). Defaults to insert time.';
comment on column phi_access_log.actor is
  'Who acted: ''retell-agent'', ''n8n'', or ''staff:<name>'' for manual views, exports and deletes.';
comment on column phi_access_log.action is
  'What happened: a tool function name (find_patient, get_slots, book_appointment, reschedule_appointment, cancel_appointment, confirm_appointment, queue_request), or call_ended, reminder_sms, reminder_call, view_transcript, export, delete.';
comment on column phi_access_log.call_id is
  'Retell call id the action belongs to. Null for scheduled jobs and manual staff actions without a call.';
comment on column phi_access_log.patient_ref is
  'sha256(nexhealth patient id || PATIENT_HASH_SALT), hex. Never the raw id or a name.';
comment on column phi_access_log.appointment_ref is
  'sha256(nexhealth appointment id || PATIENT_HASH_SALT), hex. Null when no appointment was touched.';
comment on column phi_access_log.location is
  'Practice location the action concerned: downtown or northside.';
comment on column phi_access_log.outcome is
  'Tool rows: ok, not_found, error, denied, queued. call_ended rows: booked, rescheduled, cancelled, confirmed, transferred, info_only, queued, voicemail (from Retell post-call analysis).';
comment on column phi_access_log.detail is
  'Machine codes only (for example {"reason":"pms_error","http":503,"flagged":true}). Never transcript text, names, phone numbers or free text.';

create index if not exists phi_access_log_occurred_at_idx on phi_access_log (occurred_at);
create index if not exists phi_access_log_call_id_idx     on phi_access_log (call_id);
create index if not exists phi_access_log_patient_ref_idx on phi_access_log (patient_ref) where patient_ref is not null;

commit;
