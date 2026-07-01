#!/usr/bin/env bash
# Preflight verification for an encrypted MediFlow backup.
#
# Decrypts + decompresses a backup produced by backup-encrypted.sh in a temp file, checks
# gzip integrity and that the SQL contains the expected core tables, and reports the row
# count of key tables — WITHOUT touching the live database. It never restores automatically;
# it prints the exact command for the operator to run once satisfied.
#
#   BACKUP_ENC_KEY=... BACKUP_FILE=backups/mediflow-YYYYMMDD-HHMMSS.sql.gz.enc \
#     ./ops/backups/restore-preflight.sh
set -euo pipefail

BACKUP_ENC_KEY="${BACKUP_ENC_KEY:?set BACKUP_ENC_KEY (the AES-256 passphrase used for the backup)}"
BACKUP_FILE="${BACKUP_FILE:?set BACKUP_FILE (path to the .sql.gz.enc backup)}"
DB_NAME="${DB_NAME:-mediflow_db}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"

command -v openssl >/dev/null || { echo "openssl is required"; exit 1; }
command -v gzip    >/dev/null || { echo "gzip is required"; exit 1; }
[ -f "$BACKUP_FILE" ] || { echo "backup file not found: $BACKUP_FILE"; exit 1; }

umask 177
TMP_SQL="$(mktemp)"
cleanup() { rm -f "$TMP_SQL"; }
trap cleanup EXIT

echo "Decrypting and decompressing ${BACKUP_FILE}..."
# pipefail makes a bad passphrase (openssl) or corrupt archive (gunzip) fail loudly here.
if ! openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENC_KEY -in "$BACKUP_FILE" | gunzip > "$TMP_SQL"; then
  echo "FAIL: could not decrypt/decompress — wrong key or corrupt backup."
  exit 1
fi

# Integrity: non-empty and contains the expected schema.
if [ ! -s "$TMP_SQL" ]; then echo "FAIL: decrypted dump is empty."; exit 1; fi
MISSING=""
for table in users consultations prescriptions security_audit_logs; do
  grep -q "CREATE TABLE \`${table}\`" "$TMP_SQL" || MISSING="${MISSING} ${table}"
done
if [ -n "$MISSING" ]; then
  echo "FAIL: dump is missing expected tables:${MISSING}"
  exit 1
fi

LINES="$(wc -l < "$TMP_SQL")"
echo "OK: backup decrypts cleanly and contains the core schema (${LINES} SQL lines)."
echo
echo "Preflight passed. To RESTORE (this OVERWRITES ${DB_NAME} — take a fresh backup first):"
echo "  BACKUP_ENC_KEY=... openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENC_KEY -in ${BACKUP_FILE} \\"
echo "    | gunzip \\"
echo "    | docker compose --env-file ${ENV_FILE} -f ${COMPOSE_FILE} exec -T db \\"
echo "        sh -c 'exec mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" ${DB_NAME}'"
