# Knowledge base manifest

Every file uploaded to a Retell knowledge base is listed here with the name of the person who read it and attests it contains no patient information, the date, and the result of the automated sweep. Add a new row every time a file is replaced. Never remove old rows.

The knowledge bases are: `kb-shared` (insurance, procedures, policies, top 30 questions), `kb-downtown` (location facts), `kb-northside` (location facts). Sources are the files in `retell/kb/`, synced from the client's Google Drive folder every 24 hours.

## What counts as PHI here

Anything that identifies a person together with anything about their care. In practice for these files: any patient name, phone number, email, date of birth, address, chart or account number, appointment, balance, treatment, or a story that could identify someone ("the patient who came in Tuesday with the broken crown"). Staff and provider names are fine. Practice phone numbers and addresses are fine.

## Automated sweep

Run before every upload and after every Drive sync. Record the counts in the table.

```bash
cd retell/kb
# Name-like patterns: two capitalised words in a row that are not in the allowlist
grep -nE '\b[A-Z][a-z]+ [A-Z][a-z]+\b' *.md | grep -vE 'Dr\.|Dental|Street|Avenue|Suite|Blue Cross|Delta Dental|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday' || echo "no name-like patterns"
# Dates of birth and other full dates
grep -nE '\b(0?[1-9]|1[0-2])[/-](0?[1-9]|[12][0-9]|3[01])[/-](19|20)[0-9]{2}\b' *.md || echo "no dates"
# Phone numbers other than the practice's own
grep -nE '\(?[0-9]{3}\)?[ .-]?[0-9]{3}[ .-]?[0-9]{4}' *.md | grep -vE '<practice phone 1>|<practice phone 2>' || echo "no unexpected phone numbers"
# Emails other than the practice's own
grep -nEi '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' *.md | grep -vi '@<practice-domain>' || echo "no unexpected emails"
# Chart or account number patterns
grep -nE '\b[0-9]{5,}\b' *.md || echo "no long numbers"
```

Every hit must be either removed or explained in the Notes column (for example "provider name, allowed").

## Manifest

| Source file | Knowledge base | Version or Drive revision | Attested by (name) | Date | Sweep result (hits: names / dates / phones / emails / numbers) | No PHI | Notes |
|-------------|----------------|---------------------------|--------------------|------|-----------------------------------------------------------------|--------|-------|
| retell/kb/location-downtown.md | kb-downtown | | | | 0 / 0 / 0 / 0 / 0 | [ ] | |
| retell/kb/location-northside.md | kb-northside | | | | 0 / 0 / 0 / 0 / 0 | [ ] | |
| retell/kb/insurance-accepted.md | kb-shared | | | | 0 / 0 / 0 / 0 / 0 | [ ] | |
| retell/kb/procedures-faq.md | kb-shared | | | | 0 / 0 / 0 / 0 / 0 | [ ] | |
| retell/kb/policies.md | kb-shared | | | | 0 / 0 / 0 / 0 / 0 | [ ] | |
| retell/kb/top-30-questions.md | kb-shared | | | | 0 / 0 / 0 / 0 / 0 | [ ] | |

Tick "No PHI" only after reading the whole file yourself, not just running the sweep.

## Attestation

By adding my name to a row above I confirm I read the file in full on that date and it contains no information about any patient.

| Name | Role | Signature | Date |
|------|------|-----------|------|
| | Office manager | | |
| | Bytes Platform | | |
