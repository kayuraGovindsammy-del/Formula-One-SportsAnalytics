-- Safe migration for databases created before the API/PostgreSQL migration.
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS event_data JSONB;

UPDATE submissions
SET event_data = '{}'::jsonb
WHERE event_data IS NULL;

ALTER TABLE submissions
  ALTER COLUMN event_data SET NOT NULL;

ALTER TABLE race_results
  ADD COLUMN IF NOT EXISTS pit_stops INTEGER NOT NULL DEFAULT 0 CHECK (pit_stops >= 0);

ALTER TABLE race_results
  ADD COLUMN IF NOT EXISTS gap_to_winner_ms INTEGER
  CHECK (gap_to_winner_ms IS NULL OR gap_to_winner_ms >= 0);
