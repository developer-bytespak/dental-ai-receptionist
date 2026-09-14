# n8n credentials and environment

No secrets live in this repo. Credentials are created once in n8n's encrypted store (Settings > Credentials) with exactly the names below; the workflow JSON files reference them by name. Environment variables are set in `infra/docker-compose.yml` (values come from `infra/.env`, which is git-ignored; `infra/.env.example` lists the keys).

## Credentials (n8n encrypted store)

| Credential name | n8n type | Value | Used by |
|---|---|---|---|
| `NexHealth API` | Header Auth | Header `Authorization`, value = the NexHealth API key (raw key, no `Bearer`). Only used on `POST https://nexhealth.info/authenticates`; every other NexHealth call uses the short-lived bearer token that call returns. | 02, 03, 04, 05, 06, 07, 09 |
| `Postgres Audit DB` | Postgres | RDS host, database, user `n8n_writer`, SSL required. | 01, 08, 09, 10, 11, 12 |
| `Retell API` | Header Auth | Header `Authorization`, value = `Bearer <Retell API key>` (key must carry the webhook badge and Deploy scope). | 08, 09, 10, 11 |
| `Practice SMTP` | SMTP | Practice mail relay (host, port, user, password, TLS). | 11, 12 |

Retell webhook signature verification does not use an n8n credential: the Code nodes in 01, 08 and 10 read `RETELL_API_KEY` from the environment because HMAC verification needs the raw key inside JavaScript.

## Environment variables (docker-compose `environment:` for the n8n service)

### n8n runtime settings the workflows depend on

| Variable | Value | Why |
|---|---|---|
| `NODE_FUNCTION_ALLOW_BUILTIN` | `crypto,fs` | Code nodes use `require('crypto')` for HMAC and SHA-256 hashing (01, 02-10, 12) and `require('fs')` to read the approved-agents file (11). |
| `N8N_BLOCK_ENV_ACCESS_IN_NODE` | `false` | Code nodes and expressions read `$env.*`. |
| `GENERIC_TIMEZONE` | same as `PRACTICE_TZ` | Workflow 11 runs at 02:00 in the instance timezone. |
| `EXECUTIONS_DATA_PRUNE` / `EXECUTIONS_DATA_MAX_AGE` | `true` / `168` | 7-day execution retention (see PLAN.md section 3). |
| `N8N_DEFAULT_BINARY_MODE` | `default` (or `filesystem`) | Either works; the signature Code node reads the raw body through `getBinaryDataBuffer`. |

### Application variables

| Variable | Example | Used by | Notes |
|---|---|---|---|
| `RETELL_API_KEY` | `key_...` | 01, 08, 10 | HMAC-SHA256 secret for `X-Retell-Signature`. Same key as in the `Retell API` credential. |
| `PATIENT_HASH_SALT` | 32+ random bytes, hex | 01, 08, 09, 10, 12 | Salt for `patient_ref = sha256(patient_id + salt)` and `phone_hash = sha256(E.164 phone + salt)`. Never rotate without re-hashing `suppression_list`. |
| `PRACTICE_TZ` | `America/New_York` | 03-09 | IANA timezone for spoken dates, the 10:00 reminder gate and the batch-call window. |
| `PRACTICE_NAME` | `Bright Smile Dental` | 08, 09, 10 | Passed to the SMS agents as a dynamic variable. |
| `NEXHEALTH_SUBDOMAIN` | `bright-smile` | 02-07, 09 | `subdomain` query parameter on every NexHealth call. |
| `NEXHEALTH_LOCATION_IDS` | `{"downtown":123,"northside":456}` | 01, 09 | Maps the Retell `location` dynamic variable to NexHealth `location_id`. |
| `NEXHEALTH_APPT_TYPE_IDS` | `{"cleaning":11,"exam":12,"emergency":13,"other":12}` | 03, 04 | Maps the spoken appointment type to NexHealth `appointment_type_id`. Required unless the agent passes `provider_id`. |
| `NEXHEALTH_PROVIDER_NAMES` | `{"83":"Dr. Patel","91":"Dr. Chen"}` | 03-07, 09 | How each provider id is spoken. Falls back to `Dr. <last name>` from NexHealth `provider_name`. |
| `NEXHEALTH_OVERLAPPING_OPERATORY_SLOTS` | `false` | 03 | Set `true` only if NexHealth support says the location books by operatory and needs all operatory slots. |
| `RETELL_LOCATION_NUMBERS` | `{"+14155550100":"downtown","+14155550101":"northside"}` | 01, 08, 09 | Maps each Retell-provisioned number to a location; also used (inverted) as the SMS/batch-call `from_number`. |
| `RETELL_SMS_AGENT_ID` | `agent_...` | 08, 09 | Chat agent (`retell/agents/sms-reminder.json`) that sends confirmations and SMS reminders. |
| `RETELL_REMINDER_AGENT_ID` | `agent_...` | 09 | Voice agent for the outbound reminder batch call. |
| `RETELL_OPTOUT_AGENT_ID` | `agent_...` | 10 | Chat agent whose only job is to send the fixed unsubscribe confirmation once. |
| `REMINDER_HOUR_LOCAL` | `10` | 09 | Hour (practice time) at which reminders run. |
| `REMINDER_CALL_WINDOW_START_MIN` / `REMINDER_CALL_WINDOW_END_MIN` | `600` / `1080` | 09 | Batch-call window in minutes since local midnight (10:00 to 18:00). |
| `QUEUE_OWNER_EMAIL` | `frontdesk@...` | 12 | Receives "New booking request, ref <id>, location <x>, reason <y>". |
| `ADMIN_EMAIL` | `admin@...` | 11 | Receives the weekly agent-config audit email. |
| `MAIL_FROM` | `n8n@...` | 11, 12 | From address for both emails. |
| `APPROVED_AGENTS_JSON` | `/data/approved-agents.json` | 11 | Path (inside the n8n container; mount it read-only) to the approved Retell agent roster. Save the raw `POST /v2/list-agents` response from the first signed-off run there and copy it to `docs/evidence/`. |

## Database role note

PLAN.md section 3 gives `n8n_writer` INSERT on the log tables only. The workflows additionally need:

- `SELECT` on `phi_access_log`, `consent_events` and `suppression_list` (workflow 09 enforces the 1/day and 3/week contact limits and checks opt-in/opt-out from those tables);
- `DELETE` on `booking_queue` (workflow 11 purges rows fulfilled more than 30 days ago).

Add those grants to `db/005_roles.sql`.

## Importing the workflows

1. Import in numeric order (`n8n import:workflow --separate --input=n8n/workflows/` keeps the ids embedded in the files).
2. If the UI importer assigned new ids, open 01, 04, 05, 06 and 07 and re-select the target sub-workflow in each Execute Workflow node (01 -> 02..07 and 12; 04..07 -> 12).
3. Assign the four credentials above where a node shows a missing credential, then activate 01, 08, 09, 10, 11. Workflows 02-07 and 12 are sub-workflows and need no activation.
4. Webhook URLs to register in Retell: `https://n8n.<client-domain>/webhook/retell/tool` (custom functions), `/webhook/retell/post-call` (agent webhook), `/webhook/retell/sms-inbound` (inbound SMS webhook on each number).
