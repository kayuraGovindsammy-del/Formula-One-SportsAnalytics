-- Index session_id on the remaining event-log tables.
--
-- The statistics layer reads the whole event log for a season in one pass
-- (src/backend/src/models/events.model.ts), which means a
-- `session_id = ANY(...)` lookup against every table in that UNION. Three of
-- them had no index on session_id and were scanned in full on every request.
--
-- The others in that UNION are already covered and are deliberately not
-- repeated here:
--   laps            -> idx_laps_session
--   accepted_events -> idx_accepted_events_session
--   retirements     -> UNIQUE (session_id, driver_id), which indexes
--                      session_id as its leading column
--
-- Safe to re-run: existing databases may already have been indexed by hand.
BEGIN;

CREATE INDEX IF NOT EXISTS idx_pit_stops_session ON pit_stops(session_id);
CREATE INDEX IF NOT EXISTS idx_position_changes_session ON position_changes(session_id);
CREATE INDEX IF NOT EXISTS idx_penalties_session ON penalties(session_id);

COMMIT;
