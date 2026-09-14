-- 002_consent_events.sql
-- Record of every notice given and every consent or opt-out received, per call or SMS.
-- script_ver points at a version in docs/consent-scripts.md so the exact wording can be proven later.
-- Retention: 5 years (docs/retention-policy.md). Append-only.
-- Apply to the "receptionist" database. Idempotent.

begin;

create table if not exists consent_events (
  id          bigserial primary key,
  occurred_at timestamptz not null default now(),
  call_id     text        not null,
  phone_hash  text        not null,
  phone_last4 text        not null,
  kind        text        not null,
  script_ver  text        not null,
  channel     text        not null,
  constraint consent_events_kind_chk
    check (kind in ('recording_notice', 'ai_disclosure', 'sms_opt_in', 'sms_opt_out', 'call_opt_out')),
  constraint consent_events_channel_chk
    check (channel in ('voice', 'sms')),
  constraint consent_events_phone_last4_chk
    check (phone_last4 ~ '^[0-9]{4}$')
);

comment on table  consent_events is
  'Notices given and consents or opt-outs received. Append-only. Kept 5 years.';
comment on column consent_events.id is
  'Surrogate key.';
comment on column consent_events.occurred_at is
  'When the notice was played or the consent/opt-out was received (UTC).';
comment on column consent_events.call_id is
  'Retell call id for voice events. For SMS events, the Retell SMS message or conversation id.';
comment on column consent_events.phone_hash is
  'sha256(E.164 phone number || PATIENT_HASH_SALT), hex. Joins to suppression_list.phone_hash.';
comment on column consent_events.phone_last4 is
  'Last four digits of the phone number, so staff can confirm a record with a caller without seeing the full number.';
comment on column consent_events.kind is
  'recording_notice, ai_disclosure, sms_opt_in, sms_opt_out, call_opt_out.';
comment on column consent_events.script_ver is
  'Version of the script that was read or sent, for example v1.0. Must match a version in docs/consent-scripts.md.';
comment on column consent_events.channel is
  'voice or sms.';

create index if not exists consent_events_occurred_at_idx on consent_events (occurred_at);
create index if not exists consent_events_call_id_idx     on consent_events (call_id);
create index if not exists consent_events_phone_hash_idx  on consent_events (phone_hash);

commit;
