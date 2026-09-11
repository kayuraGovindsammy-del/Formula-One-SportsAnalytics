-- Store Jolpica fastest-lap metadata on race_results so race statistics can
-- expose fastest laps even when full lap-by-lap telemetry has not been ingested.

ALTER TABLE race_results
  ADD COLUMN IF NOT EXISTS fastest_lap_rank INTEGER
    CHECK (fastest_lap_rank IS NULL OR fastest_lap_rank > 0),
  ADD COLUMN IF NOT EXISTS fastest_lap_number INTEGER
    CHECK (fastest_lap_number IS NULL OR fastest_lap_number > 0),
  ADD COLUMN IF NOT EXISTS fastest_lap_time_ms INTEGER
    CHECK (fastest_lap_time_ms IS NULL OR fastest_lap_time_ms > 0);
