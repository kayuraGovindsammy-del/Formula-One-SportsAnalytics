-- Member 4 submission publication. Apply only after 002_account_deletion.sql.
-- Additive: does not delete, rewrite or backfill existing submissions.
BEGIN;

CREATE TABLE IF NOT EXISTS accepted_events (
  event_id VARCHAR(128) PRIMARY KEY,
  submission_id BIGINT NOT NULL UNIQUE REFERENCES submissions(submission_id),
  session_id VARCHAR(70) NOT NULL REFERENCES sessions(session_id),
  event_data JSONB NOT NULL CHECK (jsonb_typeof(event_data) = 'object'),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accepted_events_session
  ON accepted_events(session_id, event_id);

CREATE INDEX IF NOT EXISTS idx_submissions_event_id
  ON submissions ((event_data->>'event_id'))
  WHERE status IN ('PENDING', 'ACCEPTED');

CREATE INDEX IF NOT EXISTS idx_submissions_owner_history
  ON submissions(submitter_user_id, submitted_at DESC, submission_id DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_review_queue
  ON submissions(status, submitted_at DESC, submission_id DESC);

COMMIT;
