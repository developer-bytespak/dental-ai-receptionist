-- 005_roles.sql
-- Two least-privilege roles and one de-identified reporting view.
--
--   n8n_writer        used by the n8n Postgres credential.
--                     INSERT on phi_access_log and consent_events (append-only).
--                     SELECT/INSERT/UPDATE on booking_queue and suppression_list.
--                     DELETE only on booking_queue (nightly retention job).
--   dashboard_reader  used by Metabase or the n8n dashboard page.
--                     SELECT on v_call_stats only. No table access at all.
--
-- Passwords are NOT set here. After applying, run the two \password commands in db/README.md.
-- Apply to the "receptionist" database as the postgres master user. Idempotent.

begin;

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'n8n_writer') then
    create role n8n_writer login;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'dashboard_reader') then
    create role dashboard_reader login;
  end if;
end
$$;

comment on role n8n_writer       is 'n8n workflows. Append-only on log tables, read/write on queue and suppression, delete only on booking_queue.';
comment on role dashboard_reader is 'Reporting only. May read v_call_stats and nothing else.';

-- Nobody gets anything by default.
revoke all on database receptionist from public;
revoke all on schema public from public;
revoke all on all tables    in schema public from public;
revoke all on all sequences in schema public from public;

grant connect on database receptionist to n8n_writer, dashboard_reader;
grant usage   on schema public          to n8n_writer, dashboard_reader;

-- ---------------------------------------------------------------------------
-- n8n_writer
-- ---------------------------------------------------------------------------
grant insert on phi_access_log   to n8n_writer;
grant insert on consent_events   to n8n_writer;
-- 09-reminders-daily counts prior contacts per patient (1/day, 3/week) from phi_access_log.
grant select on phi_access_log   to n8n_writer;
grant select on consent_events   to n8n_writer;

grant select, insert, update on booking_queue    to n8n_writer;
grant select, insert, update on suppression_list to n8n_writer;

-- The only DELETE this role holds: nightly cleanup of fulfilled queue rows.
grant delete on booking_queue to n8n_writer;

-- bigserial columns need sequence usage for INSERT.
grant usage, select on sequence phi_access_log_id_seq to n8n_writer;
grant usage, select on sequence consent_events_id_seq to n8n_writer;
grant usage, select on sequence booking_queue_id_seq  to n8n_writer;

-- Explicitly deny what must never happen (revoke is a no-op if not granted, kept for clarity).
revoke update, delete, truncate on phi_access_log from n8n_writer;
revoke update, delete, truncate on consent_events from n8n_writer;
revoke delete, truncate         on suppression_list from n8n_writer;

-- ---------------------------------------------------------------------------
-- v_call_stats: counts by day, location, outcome. No ids, no hashes, no detail.
-- ---------------------------------------------------------------------------
-- Source rows: one call_ended row per call in phi_access_log, written by 08-retell-post-call.
-- The outcome column of that row is the Retell post-call analysis outcome:
--   booked, rescheduled, cancelled, confirmed, transferred, info_only, queued, voicemail.
--
-- handled_without_transfer_pct is per (day, location): calls whose outcome is not
-- 'transferred', divided by all calls that day at that location, times 100.
-- flagged_calls counts call_ended rows where detail->>'flagged' = 'true'
-- (set when phi_beyond_scheduling_mentioned was true).

create or replace view v_call_stats
with (security_barrier = true) as
with calls as (
  select
    (occurred_at at time zone 'UTC')::date          as day,
    coalesce(location, 'unknown')                   as location,
    outcome,
    coalesce((detail ->> 'flagged')::boolean, false) as flagged
  from phi_access_log
  where action = 'call_ended'
),
per_day_loc as (
  select
    day,
    location,
    count(*)                                                        as total_calls,
    count(*) filter (where outcome <> 'transferred')                as handled_without_transfer,
    count(*) filter (where flagged)                                 as flagged_calls
  from calls
  group by day, location
)
select
  c.day,
  c.location,
  c.outcome,
  count(*)                                                          as calls,
  p.total_calls                                                     as day_location_calls,
  round(100.0 * p.handled_without_transfer / nullif(p.total_calls, 0), 1)
                                                                    as handled_without_transfer_pct,
  p.flagged_calls
from calls c
join per_day_loc p using (day, location)
group by c.day, c.location, c.outcome, p.total_calls, p.handled_without_transfer, p.flagged_calls
order by c.day desc, c.location, c.outcome;

comment on view v_call_stats is
  'De-identified call statistics. One row per day, location and outcome. Contains no call ids, patient refs or phone data.';
comment on column v_call_stats.day is 'Calendar day (UTC date of the call end).';
comment on column v_call_stats.location is 'downtown, northside, or unknown.';
comment on column v_call_stats.outcome is 'Post-call analysis outcome: booked, rescheduled, cancelled, confirmed, transferred, info_only, queued, voicemail, unknown.';
comment on column v_call_stats.calls is 'Number of calls with this outcome on this day at this location.';
comment on column v_call_stats.day_location_calls is 'All calls on this day at this location, across outcomes.';
comment on column v_call_stats.handled_without_transfer_pct is 'Percent of the day and location calls whose outcome was not transferred. Same value on every outcome row of that day and location.';
comment on column v_call_stats.flagged_calls is 'Calls that day and location flagged for weekly QA review (phi_beyond_scheduling_mentioned).';

-- The view is owned by the applying (master) user, so it reads the table with the
-- owner privileges. dashboard_reader needs SELECT on the view only.
alter view v_call_stats owner to postgres;
grant select on v_call_stats to dashboard_reader;

-- Make sure dashboard_reader has nothing else.
revoke all on phi_access_log, consent_events, booking_queue, suppression_list from dashboard_reader;

commit;
