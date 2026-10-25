-- 001_extensions_schema.sql
-- Extensions live in `public` so every connection can resolve `vector` and `citext`.
CREATE EXTENSION IF NOT EXISTS vector;   -- pgvector: embeddings + cosine distance
CREATE EXTENSION IF NOT EXISTS citext;   -- case-insensitive text (emails)
CREATE SCHEMA IF NOT EXISTS projectpulse;
SET search_path = projectpulse, public;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     VARCHAR(60) PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shared BEFORE UPDATE trigger function: keeps updated_at honest without trusting the app.
CREATE OR REPLACE FUNCTION fn_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
