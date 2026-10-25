-- 013_roles_grants.sql
-- Least-privilege database role for the web app. The runner substitutes :'APP_DB_PASSWORD' with a
-- quoted literal taken from the environment; the password is never stored in this repository.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pp_app') THEN
    CREATE ROLE pp_app LOGIN PASSWORD :'APP_DB_PASSWORD';
  ELSE
    ALTER ROLE pp_app LOGIN PASSWORD :'APP_DB_PASSWORD';
  END IF;
END $$;

GRANT USAGE ON SCHEMA projectpulse TO pp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA projectpulse TO pp_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA projectpulse TO pp_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA projectpulse TO pp_app;
GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA projectpulse TO pp_app;
-- Append-only history: even the app role cannot rewrite it (triggers block it too).
REVOKE UPDATE, DELETE ON projectpulse.audit_logs, projectpulse.proposal_actions FROM pp_app;
-- Migrations are applied by the owner; the app must never change the schema.
REVOKE CREATE ON SCHEMA projectpulse FROM pp_app;
ALTER ROLE pp_app SET search_path = projectpulse, public;
