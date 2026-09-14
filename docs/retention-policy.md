# Data retention policy

Applies to: the AI receptionist system (Retell, n8n on AWS, RDS Postgres, NexHealth). Owner: the practice's Privacy Officer. Reviewed annually (see `compliance-checklist.md`).

## Retention schedule

| Data | Where it lives | Retained for | Enforced by | How to verify |
|------|----------------|--------------|-------------|---------------|
| Call recordings and transcripts | Retell | 90 days | Agent setting `data_storage_retention_days: 90` in `retell/agents/*.json` | Retell dashboard, open a call older than 90 days: no recording available. `audit-config.ts` output shows the value. |
| Redacted PII inside transcripts | Retell | Redacted after each call, retained with the transcript | Agent setting `pii_config.mode: post_call` and `data_storage_setting: everything_except_pii` | Open any transcript: names appear as `[PERSON_NAME 1]`. |
| Signed recording URLs | Retell | 1 hour | Agent setting `signed_url_expiration_ms: 3600000` | Copy a recording link, open it after 61 minutes: access denied. |
| `phi_access_log` | RDS `receptionist` db | 6 years | Never deleted by any job. `n8n_writer` has no DELETE on this table. | `select min(occurred_at) from phi_access_log;` |
| `consent_events` | RDS `receptionist` db | 5 years | Never deleted by any job. `n8n_writer` has no DELETE on this table. | `select min(occurred_at) from consent_events;` |
| `booking_queue` | RDS `receptionist` db | 30 days after fulfilment | Workflow 11 nightly: `delete where fulfilled_at < now() - interval '30 days'` | `select count(*) from booking_queue where fulfilled_at < now() - interval '31 days';` returns 0 |
| `suppression_list` | RDS `receptionist` db | Until the patient re-consents in writing | Removed by staff only | n/a |
| n8n execution data | RDS `n8n` db | 7 days | `EXECUTIONS_DATA_PRUNE=true`, `EXECUTIONS_DATA_MAX_AGE=168` | n8n Executions list has nothing older than 7 days |
| n8n container logs | EC2 host | Last 100 MB (5 files of 20 MB) | Docker json-file log rotation in `docker-compose.yml` | `docker inspect n8n` shows the log options |
| Caddy access logs | EC2 host | Last 100 MB | Same | Same |
| Knowledge base documents | Retell KB, client Google Drive | Until replaced | Manual; each replacement recorded in `kb-manifest.md` | Manifest date matches the live KB |
| RDS automated backups | AWS | 7 days | RDS backup retention setting | RDS console, Maintenance and backups tab |
| Retell agent configuration exports | `docs/evidence/` | 6 years, with the compliance binder | Manual | Files present |
| NexHealth data (patients, appointments) | NexHealth and Dentrix | Governed by the practice's own record retention policy and the NexHealth BAA | Practice | n/a |

## Why these periods

- Six years for the access log matches the HIPAA documentation retention requirement (45 CFR 164.316(b)(2)).
- Five years for consent events covers the TCPA limitations period for text and automated-call consent with a margin.
- Ninety days for recordings is the shortest period that still allows the monthly flagged-call review and incident investigation. Retell can also be set lower if the practice prefers.
- Thirty days for fulfilled queue rows gives the front desk time to answer questions about a request after it was completed.
- Seven days for n8n executions is enough to debug a failed workflow. Execution data can contain tool payloads, so it is kept short.

## Deletion requests

If a patient asks the practice to delete their recording before 90 days, the named Retell admin deletes the call in the Retell dashboard and a staff member inserts a `phi_access_log` row with `actor = 'staff:<name>'`, `action = 'delete'`, `call_id` set, `outcome = 'ok'`. The audit and consent rows for that call are kept; they contain hashes, not identifiers.

## Retell admin note

Retell workspace admins can redisplay redacted PII inside a transcript for the retention window. Only the named client admin holds that role (see `access-control.md`). Any such redisplay must be logged by inserting a `phi_access_log` row with `action = 'view_transcript'` and `actor = 'staff:<name>'`.

## Changes

| Date | Change | Approved by |
|------|--------|-------------|
| YYYY-MM-DD | Initial policy | Privacy Officer (name) |
