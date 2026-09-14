-- 004_suppression_list.sql
-- Phone numbers (hashed) that must not receive reminder texts or calls.
-- Written by 10-sms-opt-out (STOP keywords), 08-retell-post-call (verbal opt-out) and staff.
-- Read by 09-reminders-daily before every contact. Never deleted automatically.
-- Apply to the "receptionist" database. Idempotent.

begin;

create table if not exists suppression_list (
  phone_hash text        primary key,
  added_at   timestamptz not null default now(),
  source     text        not null,
  constraint suppression_list_source_chk
    check (source in ('sms_stop', 'verbal', 'staff'))
);

comment on table  suppression_list is
  'Do-not-contact list keyed by hashed phone number. Rows stay until a patient re-consents in writing and staff remove them.';
comment on column suppression_list.phone_hash is
  'sha256(E.164 phone number || PATIENT_HASH_SALT), hex. Same hashing as consent_events.phone_hash.';
comment on column suppression_list.added_at is
  'When the number was suppressed (UTC).';
comment on column suppression_list.source is
  'sms_stop (STOP keyword by text), verbal (said on a call), staff (added by hand).';

create index if not exists suppression_list_added_at_idx on suppression_list (added_at);

commit;
