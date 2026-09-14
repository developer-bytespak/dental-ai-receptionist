-- 003_booking_queue.sql
-- Requests the agent could not complete, handed to the front desk to finish by hand.
-- Written by 12-booking-queue-notify, marked fulfilled by staff on the n8n form page,
-- deleted by 11-retention-nightly 30 days after fulfilment.
-- Apply to the "receptionist" database. Idempotent.

begin;

create table if not exists booking_queue (
  id           bigserial primary key,
  created_at   timestamptz not null default now(),
  call_id      text        not null,
  patient_ref  text,
  location     text        not null,
  reason       text        not null,
  requested    jsonb       not null,
  fulfilled_at timestamptz,
  fulfilled_by text,
  constraint booking_queue_reason_chk
    check (reason in ('not_found', 'new_patient', 'pms_error', 'after_hours_callback')),
  constraint booking_queue_location_chk
    check (location in ('downtown', 'northside')),
  constraint booking_queue_fulfilled_pair_chk
    check ((fulfilled_at is null) = (fulfilled_by is null))
);

comment on table  booking_queue is
  'Work queue for the front desk. Rows are removed 30 days after fulfilment.';
comment on column booking_queue.id is
  'Surrogate key. The notification email links to this id only.';
comment on column booking_queue.created_at is
  'When the agent queued the request (UTC).';
comment on column booking_queue.call_id is
  'Retell call id. Staff use it to open the transcript in Retell if they need details.';
comment on column booking_queue.patient_ref is
  'sha256(nexhealth patient id || PATIENT_HASH_SALT) when the patient was identified. Null for not_found and new_patient.';
comment on column booking_queue.location is
  'downtown or northside.';
comment on column booking_queue.reason is
  'not_found (two failed identifications), new_patient, pms_error (NexHealth call failed), after_hours_callback (transfer requested outside hours).';
comment on column booking_queue.requested is
  'Codes only, for example {"type":"cleaning","pref":"morning","slot":"<slot key>","provider_id":104,"callback_last4":"1234"}. No names, no full phone numbers, no free text.';
comment on column booking_queue.fulfilled_at is
  'When staff completed the request. Null while open.';
comment on column booking_queue.fulfilled_by is
  'Staff identifier who completed it, as ''staff:<name>''. Null while open.';

create index if not exists booking_queue_created_at_idx on booking_queue (created_at);
create index if not exists booking_queue_call_id_idx    on booking_queue (call_id);
create index if not exists booking_queue_open_idx       on booking_queue (location, created_at) where fulfilled_at is null;

commit;
