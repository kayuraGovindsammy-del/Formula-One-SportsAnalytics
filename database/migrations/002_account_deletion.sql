-- Additive migration for the existing Neon database. Do not rerun schema.sql.
-- Keep the tombstone to prevent a deleted Firebase UID from recreating a profile.
BEGIN;

CREATE TABLE IF NOT EXISTS account_deletions (
  auth_uid VARCHAR(128) PRIMARY KEY,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  CHECK (attempts >= 0)
);

ALTER TABLE account_deletions
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE account_deletions
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_account_deletions_pending
  ON account_deletions(requested_at)
  WHERE completed_at IS NULL;

COMMIT;
