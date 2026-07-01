#!/usr/bin/env bash
# Encrypted MySQL backup for MediFlow.
#
# Takes a consistent logical dump of the database (inside the running `db` container),
# compresses it, and encrypts it with AES-256 (OpenSSL, PBKDF2). The plaintext dump never
# touches the host filesystem, so raw patient/clinical SQL is never left on disk.
#
#   BACKUP_ENC_KEY=... ./ops/backups/backup-encrypted.sh
#
# Restore later with ops/backups/restore-preflight.sh (verifies integrity before any restore).
set -euo pipefail

# --- config (env with sensible defaults) ---
BACKUP_ENC_KEY="${BACKUP_ENC_KEY:?set BACKUP_ENC_KEY (AES-256 passphrase; keep it out of git)}"
DB_NAME="${DB_NAME:-mediflow_db}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
OUT_DIR="${OUT_DIR:-backups}"

command -v docker  >/dev/null || { echo "docker is required"; exit 1; }
command -v openssl >/dev/null || { echo "openssl is required"; exit 1; }
command -v gzip    >/dev/null || { echo "gzip is required"; exit 1; }

umask 177
mkdir -p "$OUT_DIR"
OUT="${OUT_DIR}/mediflow-$(date +%Y%m%d-%H%M%S).sql.gz.enc"

echo "Dumping ${DB_NAME} from the db container, compressing, and encrypting (AES-256)..."
# mysqldump runs INSIDE the container, reading the root password from the container's own
# env, so the secret is never passed on the host command line. --single-transaction gives a
# consistent snapshot; --routines/--triggers preserve the append-only audit triggers.
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db \
  sh -c "exec mysqldump -uroot -p\"\$MYSQL_ROOT_PASSWORD\" --single-transaction --routines --triggers \"$DB_NAME\"" \
  | gzip -9 \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_ENC_KEY -out "$OUT"

echo "Wrote encrypted backup: ${OUT} ($(wc -c < "$OUT") bytes, mode 600)."
echo "Verify/restore with: BACKUP_ENC_KEY=... BACKUP_FILE=${OUT} ./ops/backups/restore-preflight.sh"
