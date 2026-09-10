-- Member 2 ingestion compatibility.
-- Jolpica supplies the driver's starting grid position and ingestSeason.ts
-- already writes this column. Existing databases created from the Sprint 1
-- schema do not have it, so add it safely without rewriting existing rows.
BEGIN;

ALTER TABLE race_results
  ADD COLUMN IF NOT EXISTS grid_position INTEGER;

ALTER TABLE race_results
  DROP CONSTRAINT IF EXISTS race_results_grid_position_check;

ALTER TABLE race_results
  ADD CONSTRAINT race_results_grid_position_check
  CHECK (grid_position IS NULL OR grid_position >= 0);

COMMIT;
