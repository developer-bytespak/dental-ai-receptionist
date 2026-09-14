# Database migrations

Five SQL files, applied in order, into the `receptionist` database on the RDS instance. They are idempotent, so re-running them is safe.

| File | Creates |
|------|---------|
| `001_phi_access_log.sql` | `phi_access_log` table, indexes on `occurred_at`, `call_id`, `patient_ref` |
| `002_consent_events.sql` | `consent_events` table, indexes on `occurred_at`, `call_id`, `phone_hash` |
| `003_booking_queue.sql` | `booking_queue` table, indexes on `created_at`, `call_id`, open rows |
| `004_suppression_list.sql` | `suppression_list` table, index on `added_at` |
| `005_roles.sql` | roles `n8n_writer`, `dashboard_reader`, view `v_call_stats`, grants |

Where the databases live: the RDS instance has two databases. `n8n` holds n8n's own tables (workflows, credentials, executions) and is reached by the `n8n_app` user set in `infra/.env`. `receptionist` holds the four tables above and is reached from workflows through an n8n Postgres credential that logs in as `n8n_writer`.

## Apply

Run from the EC2 host; RDS is not reachable from anywhere else. Replace `<rds-endpoint>`.

```bash
cd ~/dental-ai-receptionist
export PGSSLROOTCERT=~/dental-ai-receptionist/infra/certs/rds-global-bundle.pem
export PGCONN="host=<rds-endpoint> port=5432 user=postgres sslmode=verify-full"

# one-time: create the application database (also in infra/aws-setup.md section 6)
psql "$PGCONN dbname=postgres" -c "create database receptionist owner postgres;"

# apply in order, stop on the first error
for f in db/001_phi_access_log.sql db/002_consent_events.sql db/003_booking_queue.sql db/004_suppression_list.sql db/005_roles.sql; do
  echo "== $f"
  psql "$PGCONN dbname=receptionist" -v ON_ERROR_STOP=1 -f "$f" || break
done
```

## Set the role passwords

`005_roles.sql` creates the roles without passwords on purpose, so no secret sits in the repo. Set them interactively (the password is not echoed and not stored in shell history):

```bash
psql "$PGCONN dbname=receptionist"
```

```
\password n8n_writer
\password dashboard_reader
\q
```

Store both in the practice's password manager. Enter the `n8n_writer` password into the n8n Postgres credential named in `n8n/credentials.md`.

## Verify

```bash
psql "$PGCONN dbname=receptionist" -c "\dt" -c "\dv" -c "\du n8n_writer" -c "\du dashboard_reader"

# privileges per table
psql "$PGCONN dbname=receptionist" -c "\dp phi_access_log" -c "\dp consent_events" -c "\dp booking_queue" -c "\dp suppression_list" -c "\dp v_call_stats"

# n8n_writer can insert but not delete from the log
psql "host=<rds-endpoint> port=5432 user=n8n_writer dbname=receptionist sslmode=verify-full" \
  -c "insert into phi_access_log (actor, action, outcome) values ('n8n','smoke_test','ok');" \
  -c "delete from phi_access_log where action = 'smoke_test';"    # expect: permission denied

# dashboard_reader sees the view and nothing else
psql "host=<rds-endpoint> port=5432 user=dashboard_reader dbname=receptionist sslmode=verify-full" \
  -c "select * from v_call_stats limit 5;" \
  -c "select count(*) from phi_access_log;"                          # expect: permission denied
```

Take a screenshot of the `\dp` output and save it as `docs/evidence/db-grants-YYYY-MM-DD.png`.

## Notes

- `phi_access_log` and `consent_events` are append-only for `n8n_writer`. Corrections are made by inserting a new row, never by editing.
- `PATIENT_HASH_SALT` in `infra/.env` is what makes `patient_ref` and `phone_hash` values consistent across tables. Never change it after go-live.
- The `call_ended` row written by workflow 08 stores the Retell analysis outcome in the `outcome` column and a QA flag in `detail->>'flagged'` (true when `phi_beyond_scheduling_mentioned` was true); `v_call_stats` reads both. Keep that contract if workflow 08 changes.
- To add a migration, create `006_<name>.sql`, keep it idempotent, and add it to the table above.
