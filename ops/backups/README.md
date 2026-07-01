# Encrypted database backups

Symmetrically-encrypted logical backups of the MediFlow database, so patient/clinical data
can be recovered without ever leaving a plaintext SQL dump on the host.

## What it does
- **`backup-encrypted.sh`** — dumps the DB *inside* the `db` container (root password stays in
  the container, never on the host command line), then `gzip` → `openssl enc -aes-256-cbc -pbkdf2`.
  Output is `600`-mode `backups/mediflow-<timestamp>.sql.gz.enc`.
- **`restore-preflight.sh`** — decrypts + decompresses a backup to a temp file, verifies gzip
  integrity and that the core tables are present, and prints the exact restore command. It
  **never** overwrites the live DB automatically.

## Usage (on the EC2, from the repo directory)
```bash
# Create a backup — BACKUP_ENC_KEY is the AES passphrase; keep it OUT of git and off the repo.
BACKUP_ENC_KEY='<strong-passphrase>' ./ops/backups/backup-encrypted.sh

# Verify a backup before trusting/restoring it:
BACKUP_ENC_KEY='<same-passphrase>' \
  BACKUP_FILE=backups/mediflow-20260701-030000.sql.gz.enc \
  ./ops/backups/restore-preflight.sh
```

## Key handling
- Store `BACKUP_ENC_KEY` in your secret manager (the deploy already uses AWS Secrets Manager via
  `deploy/load-secrets.sh`), **not** in `.env.production` or git. Losing the key means losing the
  backups — they are unrecoverable by design.
- Copy the `.enc` files off the VM (e.g. `aws s3 cp` to a bucket with SSE + restricted policy).

## Scheduling (optional)
Run daily via cron on the VM (key sourced from the environment, not written to the crontab):
```cron
15 3 * * *  cd /home/ubuntu/ICT2216_P2_Grp17 && BACKUP_ENC_KEY="$(cat /root/.mediflow_backup_key)" ./ops/backups/backup-encrypted.sh >> /var/log/mediflow-backup.log 2>&1
```

## Restore (deliberate, manual)
`restore-preflight.sh` prints the precise pipeline. It **overwrites** the database, so always take
a fresh backup immediately before restoring.
