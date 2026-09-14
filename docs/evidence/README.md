# Evidence folder

Files that prove the controls described in the other docs are really in place. They go into the practice's HIPAA binder alongside the PDF exports of `docs/`. Nothing in this folder may contain patient information; screenshots of call lists or transcripts are not allowed here.

## Naming convention

`<system>-<what>-<YYYY-MM-DD>.<ext>`

- `system`: `retell`, `nexhealth`, `aws`, `n8n`, `db`, `audit`, `incident`
- `what`: short, lowercase, hyphenated
- date: the day the evidence was captured, not the day it was filed
- keep every version; do not overwrite an older file with a newer capture

Screenshots: full browser window, account or workspace name visible, no cropping of the date or the URL bar. PNG.

## Expected files

| File | What it proves | Captured when | Owner |
|------|----------------|---------------|-------|
| `retell-baa-<date>.pdf` | Countersigned Retell BAA | Phase 0 | Client |
| `retell-dpa-<date>.pdf` | Retell DPA, with the breach notification clause | Phase 0 | Client |
| `retell-subprocessor-answer-<date>.pdf` | Retell's written answer on which sub-processors the BAA covers, and on training rights | Phase 0 | Us |
| `retell-10dlc-answer-<date>.pdf` | Retell's answer on SMS campaign registration | Phase 0 | Us |
| `nexhealth-baa-<date>.pdf` | Signed NexHealth BAA | Phase 0 | Client |
| `aws-baa-<date>.pdf` | Accepted AWS BAA document from AWS Artifact | Phase 0 | Client |
| `aws-baa-accepted-<date>.png` | AWS Artifact showing the BAA as Active with the account id | Phase 0 | Client |
| `aws-sg-n8n-host-<date>.png` | Inbound rules of the EC2 security group | Phase 1 | Us |
| `aws-sg-rds-<date>.png` | Inbound rules of the RDS security group | Phase 1 | Us |
| `aws-ec2-ebs-encrypted-<date>.png` | EC2 root volume encrypted | Phase 1 | Us |
| `aws-rds-encrypted-<date>.png` | RDS encryption on, not public, 7-day backups | Phase 1 | Us |
| `db-grants-<date>.png` | `\dp` output showing role privileges | Phase 1 | Us |
| `retell-agent-reception-inbound-<date>.json` | GET response of the inbound agent (retention 90 days, PII config, webhook) | Phase 2 and after every push | Us |
| `retell-agent-reminder-outbound-<date>.json` | Same for the outbound agent | Phase 2 | Us |
| `retell-agent-sms-reminder-<date>.json` | Same for the SMS agent | Phase 2 | Us |
| `retell-kb-sweep-<date>.txt` | Output of the KB PHI sweep in `docs/kb-manifest.md` | Phase 2 and after every KB change | Us or office manager |
| `retell-workspace-roles-<date>.png` | Retell members list with roles and MFA status | Phase 7, at hand-off, annually | Client |
| `n8n-users-<date>.png` | n8n user list | Phase 7, at hand-off, annually | Client |
| `n8n-env-retention-<date>.txt` | Output of `docker compose exec n8n env \| grep -E 'EXECUTIONS_DATA|LOG_LEVEL'` | Phase 7 | Us |
| `audit-config-<date>.txt` | First passing output of `retell/scripts/audit-config.ts` (no diff) | Phase 8, then weekly by cron, annually filed | Us, then automated |
| `tests-red-team-results-<date>.md` | Completed copy of `tests/red-team-calls.md` with pass/fail ticked | Phase 8 | Us |
| `aws-iam-contractor-removed-<date>.png` | IAM user list without `bytes-contractor` | Phase 10 | Client |
| `retell-workspace-roles-handoff-<date>.png` | Retell members list after our removal | Phase 10 | Client |
| `nexhealth-users-handoff-<date>.png` | NexHealth developer portal users after our removal | Phase 10 | Client |
| `incident-<date>-<short-name>/` | Folder per incident, see `docs/incident-response.md` | As needed | Privacy Officer |

## Index

Keep this list current as files are added.

| File | Added by | Date added |
|------|----------|------------|
| | | |
