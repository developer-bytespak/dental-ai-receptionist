# retell/

Config-as-code for the Retell side of the dental AI receptionist (PLAN.md sections 4 and 5).

```
agents/                    Create Agent request bodies (voice) and Create Chat Agent body (SMS)
conversation-flow/         Create Conversation Flow request bodies
kb/                        Knowledge base markdown. Office facts only, NO PHI.
scripts/push-config.ts     create/update everything via the API, save GET responses as evidence
scripts/audit-config.ts    weekly drift check of live agents vs. these files
.ids.json                  file -> Retell id map, written by push-config, commit it
```

## 1. Prerequisites

- Node 20 or newer (uses global `fetch`).
- A Retell API key from the client's workspace (the BAA must already be signed). Export it as `RETELL_API_KEY`; never commit it.
- `cd retell && npm install` (only `typescript`, `tsx` and `@types/node`).

## 2. Fill in placeholders before the first push

Search for `<...>` in `agents/` and `conversation-flow/`:

| Placeholder | Where to get it |
|-------------|-----------------|
| `<VOICE_ID>` | Retell dashboard, Voices. Use a Retell or Cartesia voice until Retell confirms the BAA flow-down (PLAN.md 14). |
| `<CLIENT_DOMAIN>` | The n8n host, e.g. `example-dental.com` (URL becomes `https://n8n.example-dental.com/...`). Appears in `webhook_url` and every tool `url`. |
| `<KB_ID_SHARED>`, `<KB_ID_LOCATION>` | Knowledge base ids from the dashboard after creating them (section 5). |
| `<PRACTICE_NAME>`, `<LOCATION_NAME>`, `<CALLBACK_NUMBER>`, `<FRONT_DESK_E164>` | `default_dynamic_variables` fallbacks only; the inbound webhook overrides them per call (section 6). |
| `<CONVERSATION_FLOW_ID:name>`, `<RETELL_LLM_ID:name>`, `<INBOUND_AGENT_ID>` | Leave as is. `push-config` fills them from `.ids.json`. |

## 3. push-config

```
cd retell
RETELL_API_KEY=key_xxx npm run push:dry     # shows what would be created / updated
RETELL_API_KEY=key_xxx npm run push         # does it
RETELL_API_KEY=key_xxx npx tsx scripts/push-config.ts --only inbound-reception
```

What it does, in order:

1. `agents/*.llm.json` -> `POST /create-retell-llm` or `PATCH /update-retell-llm/{id}` (TODO: endpoint path not verified against docs yet; only used by the SMS chat agent).
2. `conversation-flow/*.flow.json` -> `POST /create-conversation-flow` or `PATCH /update-conversation-flow/{id}`.
3. `agents/*.json` -> voice agents (file has `voice_id`) go to `POST /create-agent` / `PATCH /update-agent/{id}`; chat agents (no `voice_id`) go to `POST /create-chat-agent` / `PATCH /update-chat-agent/{id}`.
4. After each write it `GET`s the object and writes `../docs/evidence/agent-<name>-<YYYY-MM-DD>.json` (flows: `flow-<name>-<date>.json`, LLM: `llm-<name>-<date>.json`).
5. New ids are recorded in `.ids.json`. Commit that file.

Updates create a new draft version. Review it in the dashboard, publish, then make sure both phone numbers point at the published version (Phone Numbers > number > inbound agent). Placeholders left unresolved abort the push unless `--allow-placeholders` is passed.

## 4. audit-config

```
RETELL_API_KEY=key_xxx npm run audit              # exit 0 = no drift, exit 1 = drift
RETELL_API_KEY=key_xxx npm run audit:evidence     # also writes ../docs/evidence/config-audit-<date>.json
npx tsx scripts/audit-config.ts --version latest  # check the draft instead of latest_published
```

It lists every live agent (`POST /v2/list-agents`, voice and chat), flags any agent not managed by a file here, then for each local agent compares `data_storage_setting`, `data_storage_retention_days`, `pii_config` (category order ignored), `opt_in_signed_url`, `webhook_url` and `signed_url_expiration_ms` against the live `latest_published` version. n8n workflow 11 runs this weekly and emails the output to the admin (PLAN.md section 6). Keep the first passing output in `docs/evidence/`.

## 5. Knowledge base: Google Drive sync

Three knowledge bases, one shared plus one per location:

| KB name | Files from `retell/kb/` |
|---------|------------------------|
| `kb-shared` | `insurance-accepted.md`, `procedures-faq.md`, `policies.md`, `top-30-questions.md` |
| `kb-downtown` | `location-downtown.md` |
| `kb-northside` | `location-northside.md` |

Setup in the Retell dashboard (the client's office manager keeps editing rights in Drive; nobody needs Retell access to change hours):

1. Copy the six `.md` files into a client-owned Google Drive folder named `Retell KB (no patient data)`. Convert them to Google Docs or keep them as `.txt`; Google Docs, Sheets, PDF, DOCX, TXT, HTML and CSV are accepted.
2. Before the first upload run the PHI sweep described in `docs/kb-manifest.md` (name-like patterns, dates of birth, phone numbers) and record the result there with the attesting person and date.
3. Retell dashboard > Integrations > Google Drive > connect the client's Google account. The scope is `drive.file`, so Retell only ever sees files picked in step 4.
4. Knowledge Base > Create > name it as in the table > Add > pick the connected Drive account > select the file(s) in Google's picker (the browser must allow third-party cookies from Google for the picker to load).
5. Turn on auto refresh for the KB (`enable_auto_refresh`). Retell re-checks each Drive file's last-modified time every 24 hours and re-syncs only files that changed. There is no manual "sync now"; to force a refresh, remove and re-add the file. Limits: 25 Drive sources per KB, 50 MB each.
6. Copy each `knowledge_base_id` into `conversation-flow/inbound-reception.flow.json` (`knowledge_base_ids` at the top level and on node `n_question`) replacing `<KB_ID_SHARED>` and `<KB_ID_LOCATION>`, then push.
7. Record every source in `docs/kb-manifest.md`.

Rules for the KB files: no patient names, no dates of birth, no phone numbers other than office lines, no fee quotes for a specific person, provider names only as `Dr. <LastName>`. Each file starts with the comment `NO PATIENT INFORMATION IN THIS FILE. Office facts only.`

Per-location KB: `knowledge_base_ids` on a flow is static. Simplest option that ships first: point `<KB_ID_LOCATION>` at one "locations" KB holding both location files; the `{{location}}` variable in the global prompt and question node steers retrieval. Option b, swapping KB per number through the inbound webhook's `agent_override`, is listed under TODO in section 9.

## 6. Inbound call webhook: setting `location` from `to_number`

Both Retell numbers point at the same `reception-inbound` agent. Retell calls an inbound webhook before it answers; n8n uses `to_number` to fill the dynamic variables the flow needs.

Dashboard: Phone Numbers > select the number > Inbound Webhook URL = `https://n8n.<CLIENT_DOMAIN>/webhook/retell/inbound` (API field `inbound_webhook_url` on `PATCH /update-phone-number/{phone_number}`). Do this for both numbers.

Request Retell sends (POST, JSON):

```json
{
  "event": "call_inbound",
  "call_inbound": {
    "call_id": "...",
    "from_number": "+15551230000",
    "to_number": "+15557890000",
    "agent_id": "agent_xxx",
    "agent_version": 3,
    "event_timestamp": 1757000000000
  }
}
```

n8n workflow (`n8n/workflows/00-inbound-call-webhook.json`, add it to the plan's list):

1. Webhook node, path `/webhook/retell/inbound`, respond via a Respond to Webhook node. Must answer within 10 seconds (Retell retries up to 3 times, then falls back to the number's default agent with only `default_dynamic_variables`).
2. Code node: verify `X-Retell-Signature` (`v={ms},d={hex}`; `HMAC-SHA256(rawBody + timestamp, RETELL_API_KEY)`, timestamp within 5 minutes, constant-time compare). Return 401 on failure. Use the raw body string, never re-serialised JSON.
3. Code node: map `to_number` to a location:

```js
const map = {
  "+15557890000": { location: "Downtown",  front_desk_number: "+15557890001", callback_number: "555-789-0000" },
  "+15557891000": { location: "Northside", front_desk_number: "+15557891001", callback_number: "555-789-1000" },
};
const loc = map[$json.body.call_inbound.to_number] ?? map["+15557890000"];
const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
const isOpen = isOfficeOpen(loc.location, now); // hours table per location, incl. holidays
return [{ json: { loc, isOpen } }];
```

4. Respond to Webhook node, JSON body:

```json
{
  "call_inbound": {
    "dynamic_variables": {
      "practice_name": "<PRACTICE_NAME>",
      "location": "Downtown",
      "front_desk_number": "+15557890001",
      "callback_number": "555-789-0000",
      "is_open": "true"
    },
    "metadata": { "location": "Downtown" }
  }
}
```

All dynamic variable values must be strings (`"is_open": "true"`; the flow's branch node compares it to the string `true`). Put nothing about the caller in `dynamic_variables` or `metadata`; `from_number` is already on the call object. No lookup of the caller by phone number happens here; identification is by name and date of birth inside the call.

Outbound reminders (`n8n/workflows/09-reminders-daily.json`) pass the same variables plus `day`, `time` and `patient_id` through `retell_llm_dynamic_variables` on `POST /create-batch-call`. The outbound agent's `voicemail_option` (agent-level, runs on outbound calls only) leaves practice name, day, time and callback number, nothing else.

## 7. SMS

Retell SMS uses a chat agent, not a voice agent. `agents/sms-reminder.json` is a `POST /create-chat-agent` body with the same storage, retention, PII and signed-URL settings as the voice agents; its brain is the Retell LLM in `agents/sms-reminder.llm.json` (prompt covers confirm, reschedule-by-phone, STOP handling, and the same PHI rules). After pushing, bind it on both numbers under `inbound_sms_agents` and `outbound_sms_agents` (dashboard: Phone Numbers > number > SMS). n8n sends reminders with `POST /create-sms-chat` (`from_number`, `to_number`, `override_agent_id`, `retell_llm_dynamic_variables`); the first message comes from the LLM's `begin_message`. Inbound STOP is also handled by workflow 10 via the number's `inbound_sms_webhook_url`. SMS on Retell numbers requires A2P 10DLC registration (business profile, brand, campaign; 5 to 15 business days); start it on day 1.

## 8. Contract with the n8n tool router

All seven tools POST to `https://n8n.<CLIENT_DOMAIN>/webhook/retell/tool` with `{ "name": "<tool>", "args": {...}, "call": {...} }`. The flow branches on these response shapes, so workflows 02 to 07 and 12 must return exactly:

| Tool | Success | Other |
|------|---------|-------|
| `find_patient` | `{ "status": "found", "patient_id", "first_name" }` | `{ "status": "not_found" }` |
| `get_slots` | `{ "status": "ok", "slots": [{ "id", "say" }], "say" }` (max 3) | `{ "status": "none" }` |
| `book_appointment` | `{ "status": "booked", "say" }` | `{ "status": "queued" }` |
| `reschedule_appointment` | `{ "status": "rescheduled", "say" }` | `{ "status": "queued" }` |
| `cancel_appointment` | `{ "status": "cancelled", "say" }` | `{ "status": "not_found" }` or `{ "status": "queued" }` |
| `confirm_appointment` | `{ "status": "confirmed", "say" }` | `{ "status": "not_found" }` or `{ "status": "queued" }` |
| `queue_request` | `{ "status": "queued" }` | |

`say` strings contain only day, time, provider first name and location. Keep every response under 500 characters and never include phone, email, address, codes or balances.

## 9. Unverified fields (TODO)

- `global_node_setting` on node `n_staff_request`: confirmed in the Retell TypeScript SDK (`condition`, `cool_down`, `go_back_conditions`), not on the rendered API page. If the API rejects it, remove it; every conversation node already has an explicit staff/clinical edge to `n_staff_request` and the rule is in `global_prompt`.
- `public_handoff_option` / `private_handoff_option` variants `{ "type": "static_message", "message" }` and `{ "type": "prompt", "prompt" }` on the warm transfer node: shapes inferred from the SDK type names `WarmTransferStaticMessage` / `WarmTransferPrompt`; confirm against the dashboard export after the first push.
- `agent_version: "latest_published"` on the `agent_swap` node: docs say `AgentVersionReference` accepts a number or a tag; confirm the tag string is accepted there.
- Retell LLM endpoints (`/create-retell-llm`, `/get-retell-llm/{id}`, `/update-retell-llm/{id}`) and the `.llm.json` field names (`model`, `general_prompt`, `begin_message`, `model_temperature`).
- Inbound webhook `agent_override` response shape (per-number KB swap).
- `vocab_specialization: "medical"` and `stt_mode: "accurate"`: valid enum values per docs, but check they are covered by Retell's BAA answer (Phase 0 item 8) since they may route to a different STT provider.
