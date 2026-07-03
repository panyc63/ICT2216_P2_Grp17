-- Live-DB migration: persist the signed MC verification token so certificates can carry a QR.
--
-- setup.sql only runs on a FRESH MySQL volume, so an existing production database will not pick up
-- the new column on a plain redeploy. Apply this once against the live DB. It is idempotent
-- (guarded ADD COLUMN), so re-running it is harmless. Existing certificates issued before this
-- migration will have a NULL token (no QR); newly issued ones will carry it.
--
-- Usage on the VM (root, matching docker-compose.prod.yml):
--   docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db \
--     sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < ops/db/migrate-mc-token.sql

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medical_certificates' AND COLUMN_NAME = 'verification_token'
);
SET @ddl := IF(@has_col = 0,
  'ALTER TABLE medical_certificates ADD COLUMN verification_token TEXT NULL AFTER signature_hash',
  'DO 0');
PREPARE add_col FROM @ddl;
EXECUTE add_col;
DEALLOCATE PREPARE add_col;
