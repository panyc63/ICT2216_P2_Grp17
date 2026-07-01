#!/usr/bin/env bash
# Boot the MediFlow stack locally and run the Playwright browser E2E smoke suite against it.
#
# What it does (all on localhost, nothing published):
#   1. seed an already-running MySQL/MariaDB from setup.sql
#   2. reset two seed accounts (patient + doctor) to known passwords for the tests
#   3. build the SPA with VITE_API_URL=/api and serve it via `vite preview`
#   4. run the backend on :5000; the preview proxies /api -> backend (same-origin, like prod)
#   5. run `npm --prefix e2e test`, then tear everything down
#
# The database must already be running and reachable via the DB_* env vars below (in CI,
# provide it as a service container; locally, see scripts/../e2e/README.md).
#
# Usage:  bash scripts/e2e-up.sh
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# --- config (override via env) ---------------------------------------------------------
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-rootpass}"
DB_NAME="${DB_NAME:-mediflow_db}"
BACKEND_PORT="${BACKEND_PORT:-5000}"
PREVIEW_PORT="${PREVIEW_PORT:-4180}"
E2E_PASSWORD="${E2E_PASSWORD:-E2ePassw0rd!}"
PATIENT_EMAIL="${E2E_PATIENT_EMAIL:-john@gmail.com}"
DOCTOR_EMAIL="${E2E_DOCTOR_EMAIL:-doctor@mediflow.com}"

WORK="$(mktemp -d)"
BACKEND_LOG="$WORK/backend.log"
PREVIEW_LOG="$WORK/preview.log"
backend_pid=""
preview_pid=""

mysql_do() { mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$@"; }

cleanup() {
  [ -n "$preview_pid" ] && kill "$preview_pid" 2>/dev/null || true
  [ -n "$backend_pid" ] && kill "$backend_pid" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT

# --- 1. seed schema + data -------------------------------------------------------------
echo "[e2e] seeding $DB_NAME from setup.sql ..."
mysql_do -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\`;" || { echo "[e2e] cannot reach the database"; exit 1; }
mysql_do "$DB_NAME" < "$REPO/setup.sql" || { echo "[e2e] failed to seed setup.sql"; exit 1; }

# --- 2. reset two seed accounts to known passwords -------------------------------------
echo "[e2e] resetting E2E account passwords ..."
HASH="$(cd "$REPO/backend" && node -e "import('./security.js').then(async (m) => process.stdout.write(await m.hashPassword(process.argv[1])))" "$E2E_PASSWORD")"
if [ -z "$HASH" ]; then echo "[e2e] failed to compute password hash"; exit 1; fi
mysql_do "$DB_NAME" -e "UPDATE users SET password_hash='$HASH', is_verified=TRUE, status='Active', token_version=0 WHERE email IN ('$PATIENT_EMAIL','$DOCTOR_EMAIL');"

# --- 3. build the SPA (same-origin /api) -----------------------------------------------
echo "[e2e] building frontend ..."
VITE_API_URL=/api npm --prefix "$REPO/frontend" run build >/dev/null

# --- 4. start backend + preview --------------------------------------------------------
echo "[e2e] starting backend on :$BACKEND_PORT ..."
env NODE_ENV=test PORT="$BACKEND_PORT" \
  DB_HOST="$DB_HOST" DB_PORT="$DB_PORT" DB_USER="$DB_USER" DB_PASSWORD="$DB_PASSWORD" DB_NAME="$DB_NAME" \
  JWT_SECRET="${JWT_SECRET:-ci-only-jwt-secret-change-me-32-bytes-minimum}" \
  CSRF_SECRET="${CSRF_SECRET:-ci-only-csrf-secret-change-me-32-bytes-minimum}" \
  DATA_ENCRYPTION_KEY="${DATA_ENCRYPTION_KEY:-ci-only-data-encryption-key-32-bytes-minimum}" \
  MC_SIGNING_KEY="${MC_SIGNING_KEY:-ci-only-mc-signing-key-32-bytes-minimum-ok}" \
  STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-whsec_ci_only_test_secret}" \
  node "$REPO/backend/server.js" >"$BACKEND_LOG" 2>&1 &
backend_pid=$!

echo "[e2e] starting preview on :$PREVIEW_PORT ..."
env VITE_API_PROXY_TARGET="http://127.0.0.1:$BACKEND_PORT" \
  npm --prefix "$REPO/frontend" run preview -- --port "$PREVIEW_PORT" --host 127.0.0.1 >"$PREVIEW_LOG" 2>&1 &
preview_pid=$!

wait_for() { # url label
  for _ in $(seq 1 30); do curl -fsS "$1" >/dev/null 2>&1 && { echo "[e2e] $2 up"; return 0; }; sleep 1; done
  echo "[e2e] $2 FAILED to start"; return 1
}
wait_for "http://127.0.0.1:$BACKEND_PORT/api/health" backend || { tail -30 "$BACKEND_LOG"; exit 1; }
wait_for "http://127.0.0.1:$PREVIEW_PORT/" preview || { tail -30 "$PREVIEW_LOG"; exit 1; }

# --- 5. run the browser suite ----------------------------------------------------------
echo "[e2e] running Playwright ..."
env E2E_BASE_URL="http://127.0.0.1:$PREVIEW_PORT" \
  E2E_PATIENT_EMAIL="$PATIENT_EMAIL" E2E_PATIENT_PASSWORD="$E2E_PASSWORD" \
  E2E_DOCTOR_EMAIL="$DOCTOR_EMAIL" E2E_DOCTOR_PASSWORD="$E2E_PASSWORD" \
  npm --prefix "$REPO/e2e" test
