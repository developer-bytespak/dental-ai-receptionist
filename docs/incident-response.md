# Incident response plan

For any suspected or confirmed unauthorized access to, or disclosure of, patient information through the AI receptionist system. Written for the practice's Privacy Officer and for us as the business associate.

## Contacts

Fill in before go-live and keep current.

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Practice Privacy Officer (decides on notification) | | | |
| Practice owner / dentist | | | |
| Office manager (queue owner) | | | |
| Bytes Platform (business associate, technical lead) | | | bytesuite@bytesplatform.com |
| Retell support | | | support@retellai.com (confirm in the Retell dashboard) |
| NexHealth support | | | via developers.nexhealth.com (confirm) |
| AWS Support | | | AWS console, Support Center |
| Practice's HIPAA attorney or consultant (if any) | | | |

## The two clocks

1. **Business associate to practice: 60 days maximum.** Under 45 CFR 164.410 we must notify the practice of a breach of unsecured PHI without unreasonable delay and no later than 60 calendar days after we discover it. Our internal target is 24 hours. The practice then owns notification to patients (60 days from discovery), to HHS, and to the media if 500 or more people are affected.
2. **Retell's DPA: 5 days.** PLAN.md records that Retell's data processing agreement commits Retell to notify the customer within 5 days of a personal data breach on their side. Confirm the exact wording against the signed Retell BAA and DPA in `evidence/` and correct this line if it differs. If Retell notifies the practice, the practice forwards it to us the same day.

Discovery means the day anyone at the practice or at Bytes Platform knew, or reasonably should have known, about the event. Write that date down first.

## Step by step

### 1. Contain (first hour)

- Write down: who noticed, what they saw, the date and time, and the call ids or file names involved.
- If a credential may be exposed, rotate it now (section "Revoke keys" below). Rotating is always safe; the system keeps running once `.env` and the n8n credential are updated.
- If the n8n host may be compromised: from the AWS console, edit `sg-n8n-host` and remove every inbound rule except SSH from our IP. Retell calls will fail to reach n8n and the agent will fall back to the queue script; that is acceptable during containment.
- If a Retell account may be compromised: the Retell owner removes every other seat and rotates the API key.
- Do not delete anything. Logs and recordings are evidence.

### 2. Assess (first day)

Work out what data was involved and for whom.

Pull the audit rows for the period:

```sql
select occurred_at, actor, action, call_id, location, outcome, detail
from phi_access_log
where occurred_at between '<start>' and '<end>'
order by occurred_at;
```

Pull the transcript and recording for a specific call. Use the Retell API with the owner's key (or the dashboard, Calls, search by call id):

```bash
curl -s https://api.retellai.com/v2/get-call/<call_id> \
  -H "Authorization: Bearer $RETELL_API_KEY" | jq '{call_id, start_timestamp, end_timestamp, from_number, to_number, transcript, recording_url, call_analysis}'
```

The stored transcript is redacted. If the assessment needs the unredacted text, only the named Retell admin may redisplay it, and they insert a row first:

```sql
insert into phi_access_log (actor, action, call_id, outcome, detail)
values ('staff:<name>', 'view_transcript', '<call_id>', 'ok', '{"reason":"incident","incident_id":"<id>"}');
```

List which consent rows and queue rows relate to the calls:

```sql
select * from consent_events where call_id = any(array['<call_id>', ...]);
select id, created_at, call_id, location, reason, fulfilled_at from booking_queue where call_id = any(array['<call_id>', ...]);
```

To map a `patient_ref` back to a patient (needed to notify them), compute `sha256(nexhealth_patient_id || PATIENT_HASH_SALT)` for candidate ids from NexHealth, or ask us to run the lookup. The salt is in `infra/.env` on the host and in the password manager.

Decide whether this is a breach of unsecured PHI. Use the four-factor risk assessment in 45 CFR 164.402: nature and extent of the PHI, who received it, whether it was actually viewed, and the extent to which the risk has been mitigated. Record the answers.

### 3. Notify

- Bytes Platform notifies the Privacy Officer in writing (email plus phone) within 24 hours of discovery, and in any case within 60 days. The notice states what happened, the call ids or record counts, what we did, and what we recommend.
- The Privacy Officer decides on patient notification. Patients: written notice within 60 days of discovery. HHS: within 60 days if 500 or more affected, otherwise in the annual log within 60 days after year end. Media: if 500 or more residents of one state.
- If the event originated at Retell, NexHealth or AWS, open a support case with them the same day and ask for their incident report in writing. Save it to `evidence/incident-<id>/`.

### 4. Revoke keys

Do these in order. Each takes a few minutes.

Retell API key:
1. Retell dashboard, Settings, API Keys. Create a new key with the webhook badge, then delete the old one.
2. On the EC2 host: edit `infra/.env`, set `RETELL_API_KEY`, then `docker compose up -d n8n`.
3. In n8n, open the Retell credential and paste the new key.
4. Make a test call. Confirm a new `phi_access_log` row appears. If not, signature verification is failing; check the key.

NexHealth API key:
1. developers.nexhealth.com, regenerate the key.
2. Update `NEXHEALTH_API_KEY` in `infra/.env` and the n8n NexHealth credential. Restart n8n.
3. Run the auth request in `tests/nexhealth-sandbox.http` against production to confirm.

RDS passwords:
1. As `postgres` on the EC2 host: `alter role n8n_writer password '<new>';` and `alter role n8n_app password '<new>';`
2. Update `DB_POSTGRESDB_PASSWORD` in `.env` and the n8n Postgres credential. Restart n8n.
3. RDS console, Modify, new master password, apply immediately.

AWS:
1. IAM, delete or deactivate any access key that may be exposed. Create a new one.
2. If the EC2 key pair may be exposed: create a new key pair, add its public key to `~/.ubuntu/.ssh/authorized_keys`, remove the old line.

n8n:
1. Owner opens Settings, Users, and removes any unexpected user.
2. Change the Caddy basic auth password (`caddy hash-password`), update `.env`, `docker compose up -d caddy`.

`N8N_ENCRYPTION_KEY` cannot be rotated in place. If it is exposed, the credentials it protects must be rotated (above), which makes the old encrypted values worthless.

### 5. Recover

- Restore the security group rules.
- Re-run `retell/scripts/audit-config.ts` and confirm no drift from the approved agent JSON.
- Re-run tests 1, 5 and 8 from `tests/red-team-calls.md`.
- Confirm reminders resumed (workflow 09 execution list).

### 6. Record and learn

Create `evidence/incident-<YYYY-MM-DD>-<short-name>/` with: the timeline, the audit rows exported as CSV, the risk assessment, copies of every notification sent, vendor reports, and a short "what we changed" note. Keep it six years.

Update this plan if any step was unclear.

## Incident log

| Id | Discovered | Summary | Breach (yes/no) | Notified practice on | Closed |
|----|-----------|---------|-----------------|----------------------|--------|
| | | | | | |
