# Access control

Who can reach what, and the rules for keeping it that way. Owner: the practice's Privacy Officer. Reviewed at hand-off, then annually and whenever someone joins or leaves.

## Roster

Fill in real names. One person per row. Keep a screenshot of each system's user list next to this file in `evidence/` (naming in `evidence/README.md`).

| System | Role | Named person | Email | MFA on | Granted on | Removed on | Notes |
|--------|------|--------------|-------|--------|------------|------------|-------|
| Retell workspace | Owner (admin) | | | yes | | | The only person who may redisplay redacted PII, manage API keys, delete calls |
| Retell workspace | Admin (contractor) | Bytes Platform | bytesuite@bytesplatform.com | yes | | at hand-off | Removed on Day 14 |
| Retell workspace | Viewer | | | yes | | | Named viewer for recordings. Can listen, cannot change settings |
| n8n | Owner | | | yes | | | Same person as the Retell owner unless the practice decides otherwise |
| n8n | Member (contractor) | Bytes Platform | bytesuite@bytesplatform.com | yes | | at hand-off | |
| n8n | Queue page user | | | n/a (Caddy basic auth + office IP) | | | Named front-desk queue owner. Marks booking_queue rows fulfilled |
| AWS account | Root / admin | | | yes | | | Never used day to day. Root MFA required |
| AWS IAM | `bytes-contractor` | Bytes Platform | bytesuite@bytesplatform.com | n/a (access keys) | | at hand-off | Deleted on Day 14, screenshot as evidence |
| RDS Postgres | `postgres` master | | | n/a | | | Password in the practice password manager. Used only for migrations and incident work |
| RDS Postgres | `n8n_app` | system | | n/a | | | n8n's own tables. Password in `infra/.env` on the host only |
| RDS Postgres | `n8n_writer` | system | | n/a | | | Stored inside n8n credentials only |
| RDS Postgres | `dashboard_reader` | | | n/a | | | Only if the optional dashboard is built |
| NexHealth developer portal | Owner | | | yes | | | |
| NexHealth developer portal | Developer (contractor) | Bytes Platform | bytesuite@bytesplatform.com | yes | | at hand-off | |
| Google Drive KB folder | Editor | | | yes | | | Office manager who maintains office facts |
| EC2 host (SSH) | `ubuntu` via key `n8n-receptionist-key` | Bytes Platform, then client IT | | key-based | | | Key held in the password manager. Rotate at hand-off |

## Role rules

### Retell

- Exactly three seats: one owner, one admin during the build (us), one viewer. Nobody else.
- MFA is required on every seat. The owner turns it on in workspace settings and checks the roster monthly.
- The owner is the only person who may: create or rotate API keys, change agent settings outside the config-as-code push, delete recordings, or redisplay redacted PII.
- **Redacted PII can be redisplayed by Retell admins.** Retell's post-call redaction hides names, dates of birth, phone numbers, addresses, emails, medical ids, account numbers and SSNs in the stored transcript, but a workspace admin can reveal the original text for as long as the recording is retained. This is why only one named person holds admin and why every redisplay is logged as a `view_transcript` row in `phi_access_log` (see `retention-policy.md`).
- The viewer role is for listening to flagged calls during the monthly review. Viewers cannot change settings and cannot redisplay PII.
- API keys: one key with the webhook badge, used by n8n only. It lives in `infra/.env` on the host and in the n8n credential. Never in chat, email or a ticket.

### n8n

- Login is n8n's own user accounts with MFA enforced (`N8N_MFA_ENFORCED_ENABLED=true`), behind Caddy basic auth and an IP allowlist of the two offices.
- Owner is the client admin. We are a member until hand-off, then removed.
- Credentials (Postgres, NexHealth, Retell) are stored in n8n's encrypted credential store. Members can use them in workflows but cannot read the values back.
- The public API is disabled (`N8N_PUBLIC_API_DISABLED=true`).
- The queue page is an n8n form. It shows call id, location, reason, requested codes and a "mark fulfilled" button. It never shows names or numbers.

### AWS

- The practice owns the account. Root user has MFA and is not used for daily work.
- Our IAM user `bytes-contractor` has EC2, RDS and VPC rights during the build and is deleted at hand-off.
- No one else needs console access to run the system. Client IT gets the SSH key and the IAM admin role for maintenance after hand-off.
- RDS is not publicly reachable. Only the EC2 security group may connect on 5432.

### NexHealth

- The practice owns the developer account and the API key. One key for production. The sandbox key is separate and deleted after Phase 6.
- Only the workflows use the key. Staff do not call the API by hand.

### Database roles

- `n8n_writer`: INSERT on `phi_access_log` and `consent_events`; SELECT, INSERT, UPDATE on `booking_queue` and `suppression_list`; DELETE only on `booking_queue`. No other rights.
- `dashboard_reader`: SELECT on `v_call_stats` only.
- `postgres` master: migrations and incident response. Every manual use is recorded in `phi_access_log` as `actor = 'staff:<name>'`.

## Joiners, movers, leavers

- New staff who need viewer access: the owner adds them in Retell as a viewer, turns on MFA, adds a row above, takes a new screenshot.
- Anyone leaving the practice: same day, the owner removes them from Retell, n8n and Google Drive, fills in the "Removed on" column, and, if they held the Retell owner or admin role, rotates the Retell API key and updates `infra/.env` (see `incident-response.md` for the key rotation steps).
- Hand-off checklist (Day 14): remove Bytes Platform from Retell, n8n, NexHealth; delete IAM user `bytes-contractor`; rotate the SSH key; screenshot each user list into `evidence/`.

## Review record

| Date | Reviewed by | Changes made |
|------|-------------|--------------|
| YYYY-MM-DD | | Initial roster at go-live |
