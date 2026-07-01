-- Least-privilege database users for MediFlow (SITBank-style DDL/DML separation).
--
-- Reference template. Apply with ops/db/create-app-users.sh, which injects the passwords
-- from DB_APP_PASSWORD / DB_DDL_PASSWORD (NEVER commit real passwords). Users are '@%'
-- because the backend connects from a separate Docker container (not localhost).
--
--   mediflow_app  — runtime: DML only (SELECT/INSERT/UPDATE/DELETE). No DDL, no GRANT.
--   mediflow_ddl  — migrations only: full structural privileges for ALTERs.

CREATE USER IF NOT EXISTS 'mediflow_app'@'%' IDENTIFIED BY ':DB_APP_PASSWORD:';
GRANT SELECT, INSERT, UPDATE, DELETE ON mediflow_db.* TO 'mediflow_app'@'%';

CREATE USER IF NOT EXISTS 'mediflow_ddl'@'%' IDENTIFIED BY ':DB_DDL_PASSWORD:';
GRANT ALL PRIVILEGES ON mediflow_db.* TO 'mediflow_ddl'@'%';

FLUSH PRIVILEGES;
