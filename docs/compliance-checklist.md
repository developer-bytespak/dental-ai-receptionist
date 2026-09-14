# Compliance checklist for the office manager

This is the short version of how the phone assistant keeps patient information safe and what the office needs to do to keep it that way. Print it, keep it in the HIPAA binder, and tick the boxes as you go.

## What is in place

- The phone assistant is run by three companies, and each one has signed a Business Associate Agreement with the practice: Retell (the voice and texting service), NexHealth (the link to Dentrix), and Amazon Web Services (where our automation runs). The signed copies are in the `evidence` folder.
- Every call starts with a fixed sentence telling the caller it is an automated assistant and that the call is recorded. The caller can say "staff" at any time to reach a person.
- The assistant only handles scheduling. If a caller mentions pain, medication, a diagnosis, a bill or a balance, or asks about someone else's appointment, the assistant transfers to the front desk and does not discuss it.
- Names, dates of birth, phone numbers and similar details are blanked out in stored transcripts after every call. Recordings are deleted automatically after 90 days.
- Text reminders are sent only to people who said yes on a call. Anyone can reply STOP and they will never be texted again.
- Everything the assistant does is written to an audit log that cannot be edited and is kept for six years.
- The assistant's knowledge base contains office facts only (hours, addresses, insurance, policies). It contains no patient information.
- Only three people have access to the assistant's controls: the named owner, the named viewer, and (until hand-off) Bytes Platform. All use two-factor login.

## Every month

- [ ] Open the Retell dashboard and review the calls flagged for review (the ones where a caller mentioned something medical or financial). Confirm the assistant transferred or ended the topic. Note anything odd in the review log below.
- [ ] Open the queue page and confirm there are no requests older than one business day still marked open.
- [ ] Check the user list in Retell and in n8n. It should show only the people on the roster in `access-control.md`. Remove anyone else and tell Bytes Platform.
- [ ] Confirm the reminder job ran every weekday (n8n, Executions, workflow 09). If it is missing days, tell Bytes Platform.
- [ ] Spot-check two recent transcripts. Names should appear as `[PERSON_NAME 1]`, not as real names. If you see a real name, tell Bytes Platform the same day.

Monthly review log:

| Month | Reviewed by | Flagged calls reviewed | Issues found | Action taken |
|-------|-------------|------------------------|--------------|--------------|
| | | | | |

## Every year

- [ ] Re-sign the access roster in `access-control.md`. Every person listed should still work here and still need access. Take fresh screenshots of the user lists.
- [ ] Read `retention-policy.md` and confirm the periods still match what the practice wants. Confirm with Bytes Platform that the automatic deletions are still running.
- [ ] Ask Bytes Platform to run the configuration audit (`audit-config.ts`) and file the output in `evidence`. It proves the live settings still match the approved ones.
- [ ] Check that the Retell, NexHealth and AWS agreements are still current and that no vendor has changed its terms in a way that affects patient data.
- [ ] Re-read the knowledge base documents and confirm nobody added patient details by mistake. Sign the `kb-manifest.md` again.
- [ ] Review this checklist and `incident-response.md`. Update names and phone numbers.

Annual review log:

| Year | Reviewed by | Date | Notes |
|------|-------------|------|-------|
| | | | |

## Editing the assistant's knowledge base

- Only edit the files in the shared Google Drive folder. They update automatically within 24 hours.
- Facts only: hours, addresses, parking, insurance plans accepted, fee ranges, policies, common questions.
- Never put a patient name, phone number, date of birth, or anything about an individual's treatment in these files.
- After an edit, add a line to `kb-manifest.md` with your name and the date.

## If you think something went wrong

"Something went wrong" includes: a caller says the assistant told them about another patient; a transcript shows real names instead of blanks; a text went to someone who said STOP; someone you do not recognise appears in a user list; a laptop or phone with access is lost; an email arrives from Retell, NexHealth or AWS about a security event.

1. Write down what you saw, when, and any call id or phone number involved. Do not delete anything.
2. Call the Privacy Officer and email Bytes Platform (bytesuite@bytesplatform.com) the same day.
3. If a password or key may have leaked, ask Bytes Platform to rotate it immediately. This does not stop the phones from working.
4. Follow `incident-response.md`. The Privacy Officer decides whether patients need to be told. The practice has 60 days from the day you noticed to notify patients if it is a breach; Bytes Platform must report to the practice well inside that window.
5. Keep every note and email in a dated folder under `evidence`.

## Who to call

| Question | Contact |
|----------|---------|
| Assistant said something wrong, calls not coming through, texts not sending | Bytes Platform, bytesuite@bytesplatform.com |
| A patient wants their recording deleted | Retell owner (see roster), then log it per `retention-policy.md` |
| Someone new needs access | Retell owner adds them as a viewer and updates the roster |
| Possible breach | Privacy Officer, then Bytes Platform, same day |
