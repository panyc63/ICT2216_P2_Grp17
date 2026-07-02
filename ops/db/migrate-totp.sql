-- Live-DB migration: authenticator-app TOTP (replaces the removed WebAuthn passkeys).
--
-- setup.sql only runs on a FRESH MySQL volume, so an existing production database will not
-- pick up new columns on a plain redeploy. Apply this once against the live DB. It is
-- idempotent (guarded ADD COLUMN + DROP TABLE IF EXISTS), so re-running it is harmless.
--
-- Usage on the VM (root, matching docker-compose.prod.yml):
--   docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db \
--     sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < ops/db/migrate-totp.sql

-- 1) Add the TOTP columns to users only if they are absent. MySQL (unlike MariaDB) has no
--    "ADD COLUMN IF NOT EXISTS", so gate the ALTER on information_schema via a prepared stmt.
SET @has_totp := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'totp_secret_encrypted'
);
SET @ddl := IF(@has_totp = 0,
  'ALTER TABLE users
     ADD COLUMN totp_secret_encrypted TEXT NULL,
     ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
     ADD COLUMN totp_enrolled_at TIMESTAMP NULL DEFAULT NULL',
  'DO 0');
PREPARE add_totp FROM @ddl;
EXECUTE add_totp;
DEALLOCATE PREPARE add_totp;

-- 2) Drop the now-unused WebAuthn tables (safe whether or not they exist).
DROP TABLE IF EXISTS webauthn_challenges;
DROP TABLE IF EXISTS webauthn_credentials;

-- If you flipped to the least-privilege DML user (mediflow_app), it already holds
-- SELECT/INSERT/UPDATE/DELETE on the whole schema, so no extra grants are needed.
-- (This DDL must be run by root or the mediflow_ddl migration user.)
