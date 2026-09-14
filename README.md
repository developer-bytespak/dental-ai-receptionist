# Dental AI Receptionist (Retell + n8n + NexHealth)

A HIPAA-compliant phone receptionist for a two-location dental practice that runs Dentrix on-premises. The agent answers the practice's phone lines, books, confirms, cancels and reschedules appointments, answers office questions (hours, insurance, procedures, policies), sends reminders by text or voice, and transfers to staff whenever a caller asks for a person or raises anything clinical or financial. Bookings are written into Dentrix through NexHealth's Synchronizer API. Retell provides the voice agent, phone numbers and SMS; n8n (self-hosted on AWS) runs the workflows; Postgres on RDS holds the audit log, consent records, booking queue and SMS suppression list.

Because the agent handles patient names and appointment data, every vendor in the chain is covered by a Business Associate Agreement (Retell, NexHealth, AWS) and the design keeps PHI to the minimum needed to schedule. Recordings and transcripts are redacted after each call and expire after 90 days. The knowledge base contains office facts only, never patient data. Every tool call and every consent event is logged to Postgres with hashed patient references, and the log is kept for six years. A compliance document pack in `docs/` gives the practice the consent scripts, retention policy, access roster, incident response plan and a plain-language checklist for the office manager.

This repository is the single source of truth for the build. Retell agent configuration is stored as JSON and pushed by script, n8n workflows are exported after every change, database migrations are numbered SQL files, and evidence (signed BAAs, agent exports, screenshots) is collected under `docs/evidence/`. See `PLAN.md` for the full build plan, phases and decisions.

## Repo layout

```
dental-ai-receptionist/
  README.md
  PLAN.md                         # build plan
  infra/
    docker-compose.yml            # n8n + caddy (TLS)
    Caddyfile
    .env.example
    aws-setup.md                  # EC2/Lightsail + RDS steps, security groups, BAA acceptance
  retell/
    agents/
      inbound-reception.json      # agent config (storage, retention, PII, webhook)
      outbound-reminder.json
      sms-reminder.json
    conversation-flow/
      inbound-reception.flow.json
      outbound-reminder.flow.json
    kb/                           # office facts only, NO PHI
      location-downtown.md
      location-northside.md
      insurance-accepted.md
      procedures-faq.md
      policies.md
      top-30-questions.md
    scripts/
      push-config.ts              # config-as-code: PUT agents via Retell API, save response as evidence
      audit-config.ts             # weekly diff of live agents vs approved JSON
  n8n/
    workflows/
      01-retell-tool-router.json
      02-find-patient.json
      03-get-slots.json
      04-book-appointment.json
      05-reschedule-appointment.json
      06-cancel-appointment.json
      07-confirm-appointment.json
      08-retell-post-call.json
      09-reminders-daily.json
      10-sms-opt-out.json
      11-retention-nightly.json
      12-booking-queue-notify.json
    credentials.md                # which credentials each workflow needs (no secrets)
  db/
    001_phi_access_log.sql
    002_consent_events.sql
    003_booking_queue.sql
    004_suppression_list.sql
    005_roles.sql                 # n8n insert-only role, dashboard read-only view
    README.md
  docs/
    consent-scripts.md            # versioned scripts, v1.0
    retention-policy.md
    access-control.md
    incident-response.md
    compliance-checklist.md       # for the office manager
    kb-manifest.md                # every KB source + "no PHI" attestation
    client-kickoff-request.md     # email to the client for Day 1
    evidence/                     # BAA PDFs, agent JSON exports, screenshots
  tests/
    red-team-calls.md             # 20 scripted calls
    nexhealth-sandbox.http
    sample-tool-payloads.json
```

## Quick start

Prerequisites: the client has completed the eight kickoff items in `docs/client-kickoff-request.md` (Retell, AWS and NexHealth accounts exist with BAAs signed, and we have admin access to each).

1. Provision AWS. Follow `infra/aws-setup.md` to create the EC2 host, the RDS Postgres instance, security groups and the IAM user. Save the screenshots it asks for into `docs/evidence/`.
2. Configure and start n8n on the EC2 host.
   ```bash
   git clone <this repo> && cd dental-ai-receptionist/infra
   cp .env.example .env            # fill in every value
   docker compose up -d
   docker compose logs -f n8n      # wait for "Editor is now accessible"
   ```
   Open `https://n8n.<client-domain>`, create the owner account (the client admin), then invite us as a member.
3. Apply the database migrations. Follow `db/README.md` (five files, applied in order, then set the two role passwords).
4. Create n8n credentials (Postgres as `n8n_writer`, NexHealth API key, Retell API key) and import the workflows from `n8n/workflows/`. Names are listed in `n8n/credentials.md`.
5. Push the Retell agents with `retell/scripts/push-config.ts`. Upload `retell/kb/*.md` as knowledge bases after completing `docs/kb-manifest.md`.
6. Run the sandbox requests in `tests/nexhealth-sandbox.http` and the 20 calls in `tests/red-team-calls.md`. Record pass/fail.
7. Export evidence (agent JSON, config-audit output) into `docs/evidence/` and hand the `docs/` pack to the practice.

## Documentation

- Build plan and decisions: `PLAN.md`
- Infrastructure: `infra/aws-setup.md`, `infra/.env.example`
- Database: `db/README.md`
- Consent scripts (v1.0): `docs/consent-scripts.md`
- Retention policy: `docs/retention-policy.md`
- Access control and roster: `docs/access-control.md`
- Incident response: `docs/incident-response.md`
- Office manager checklist: `docs/compliance-checklist.md`
- Knowledge base manifest: `docs/kb-manifest.md`
- Evidence index: `docs/evidence/README.md`
- Client kickoff email: `docs/client-kickoff-request.md`
- Test plan: `tests/red-team-calls.md`

## External references used

- n8n environment variables: https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables.md
- n8n Docker Compose install: https://docs.n8n.io/deploy/host-n8n/install-options/install-using-docker-compose.md
- NexHealth API reference: https://docs.nexhealth.com/reference
- Retell webhook signing: https://docs.retellai.com/features/secure-webhook
- Retell custom functions: https://docs.retellai.com/build/conversation-flow/custom-function
