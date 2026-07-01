# DB account isolation (DDL vs DML)

Runs the application on a **least-privilege** database user instead of `root`, so a compromise
of the app (e.g. an unforeseen injection) cannot `DROP`/`ALTER` tables, create users, or read
outside `mediflow_db`.

- **`mediflow_app`** — runtime user: `SELECT, INSERT, UPDATE, DELETE` only (no DDL, no GRANT).
- **`mediflow_ddl`** — migrations only: full structural privileges for `ALTER`s.

Users are `'…'@'%'` because the backend connects from a **separate Docker container**, not
`localhost`.

## Phased, non-breaking rollout

### Phase 1 — provision the users (nothing changes at runtime)
The app keeps using `root`; you just create the users and prove the DML-only user is sufficient.
```bash
# On the EC2, from the repo dir:
DB_APP_PASSWORD='<app pw>' DB_DDL_PASSWORD='<ddl pw>' ./ops/db/create-app-users.sh
```
This is idempotent (safe to re-run). It's also what a fresh install runs after first boot, since
`setup.sql` intentionally does not hardcode these passwords.

### Verify (before the flip)
Confirm the app works end-to-end as `mediflow_app`: point a **staging/local** backend at
`DB_USER=mediflow_app` and run the integration suite — it must stay green (proves the runtime path
needs only DML). This repo's change was verified this way.

### Phase 2 — flip the runtime user (maintenance window)
In `.env.production`:
```
DB_USER=mediflow_app
DB_PASSWORD=<app pw>     # the DB_APP_PASSWORD you set above
```
Then restart the backend:
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```
Keep `mediflow_ddl` for future schema changes (run `ALTER`s as that user, not the app user).

### Rollback
Revert `DB_USER=root` (and `DB_PASSWORD` back to the root password) and restart the backend.

## Note on backups/migrations
`ops/backups/*.sh` and one-off `ALTER`s still use the root/DDL credentials — only the long-running
application process drops to `mediflow_app`.
