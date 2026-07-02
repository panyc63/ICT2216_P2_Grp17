-- Live-DB migration: WebAuthn passkey tables.
--
-- setup.sql only runs on a FRESH MySQL volume, so an existing production database will not
-- pick up new tables on a plain redeploy. Apply this once against the live DB. It is
-- idempotent (CREATE TABLE IF NOT EXISTS), so re-running it is harmless.
--
-- Usage on the VM (root, matching docker-compose.prod.yml):
--   docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db \
--     sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < ops/db/migrate-webauthn.sql

-- WebAuthn / FIDO2 passkeys (see backend/webauthn.js).
CREATE TABLE IF NOT EXISTS webauthn_credentials (
    credential_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    public_key TEXT NOT NULL,
    counter BIGINT NOT NULL DEFAULT 0,
    transports VARCHAR(120) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_webauthn_user (user_id)
);
CREATE TABLE IF NOT EXISTS webauthn_challenges (
    user_id VARCHAR(36) PRIMARY KEY,
    challenge VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- If you flipped to the least-privilege DML user (mediflow_app), it already holds
-- SELECT/INSERT/UPDATE/DELETE on the whole schema, so no extra grants are needed.
-- (This DDL must be run by root or the mediflow_ddl migration user.)
