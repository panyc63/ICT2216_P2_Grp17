#!/usr/bin/env bash
# Create/refresh MediFlow's least-privilege DB users on the live database.
#
# Phase 1 of DB account isolation: creates a DML-only runtime user (mediflow_app) and a
# DDL migration user (mediflow_ddl) WITHOUT changing what the app uses yet (it stays on
# root until Phase 2). Idempotent — safe to re-run. Passwords come from the environment
# and are never written to git. Avoid quote characters in the passwords.
#
#   DB_APP_PASSWORD=... DB_DDL_PASSWORD=... ./ops/db/create-app-users.sh
set -euo pipefail

DB_APP_PASSWORD="${DB_APP_PASSWORD:?set DB_APP_PASSWORD (runtime DML user password)}"
DB_DDL_PASSWORD="${DB_DDL_PASSWORD:?set DB_DDL_PASSWORD (migration DDL user password)}"
DB_NAME="${DB_NAME:-mediflow_db}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"

command -v docker >/dev/null || { echo "docker is required"; exit 1; }

echo "Creating/refreshing least-privilege users on ${DB_NAME} (app=DML, ddl=DDL)..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db \
  sh -c "exec mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\"" <<SQL
CREATE USER IF NOT EXISTS 'mediflow_app'@'%' IDENTIFIED BY '${DB_APP_PASSWORD}';
ALTER USER 'mediflow_app'@'%' IDENTIFIED BY '${DB_APP_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE ON ${DB_NAME}.* TO 'mediflow_app'@'%';
CREATE USER IF NOT EXISTS 'mediflow_ddl'@'%' IDENTIFIED BY '${DB_DDL_PASSWORD}';
ALTER USER 'mediflow_ddl'@'%' IDENTIFIED BY '${DB_DDL_PASSWORD}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO 'mediflow_ddl'@'%';
FLUSH PRIVILEGES;
SQL

echo "Done. 'mediflow_app' (DML only) and 'mediflow_ddl' (migrations) are ready."
echo "Phase 2 (maintenance window): set DB_USER=mediflow_app and DB_PASSWORD=<app pw> in"
echo "${ENV_FILE}, then restart the backend. Rollback = revert DB_USER=root and restart."
