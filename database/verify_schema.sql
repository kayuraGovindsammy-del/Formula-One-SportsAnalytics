-- CI smoke checks for a fresh database built from database/schema.sql.
-- Keep this focused on objects that later migrations depend on so schema drift
-- fails loudly during CI instead of at deployment/runtime.

DO $$
BEGIN
  IF to_regclass('public.account_deletions') IS NULL THEN
    RAISE EXCEPTION 'Missing table: account_deletions';
  END IF;

  IF to_regclass('public.accepted_events') IS NULL THEN
    RAISE EXCEPTION 'Missing table: accepted_events';
  END IF;

  IF to_regclass('public.idx_account_deletions_pending') IS NULL THEN
    RAISE EXCEPTION 'Missing index: idx_account_deletions_pending';
  END IF;

  IF to_regclass('public.idx_accepted_events_session') IS NULL THEN
    RAISE EXCEPTION 'Missing index: idx_accepted_events_session';
  END IF;

  IF to_regclass('public.idx_submissions_event_id') IS NULL THEN
    RAISE EXCEPTION 'Missing index: idx_submissions_event_id';
  END IF;

  IF to_regclass('public.idx_submissions_owner_history') IS NULL THEN
    RAISE EXCEPTION 'Missing index: idx_submissions_owner_history';
  END IF;

  IF to_regclass('public.idx_submissions_review_queue') IS NULL THEN
    RAISE EXCEPTION 'Missing index: idx_submissions_review_queue';
  END IF;
END
$$;

DO $$
DECLARE
  missing_columns TEXT[];
BEGIN
  SELECT array_agg(required.column_name)
  INTO missing_columns
  FROM (
    VALUES
      ('grid_position'),
      ('fastest_lap_rank'),
      ('fastest_lap_number'),
      ('fastest_lap_time_ms')
  ) AS required(column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'race_results'
      AND c.column_name = required.column_name
  );

  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION 'Missing race_results columns: %', array_to_string(missing_columns, ', ');
  END IF;
END
$$;

DO $$
DECLARE
  season_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO season_count FROM seasons;
  IF season_count = 0 THEN
    RAISE EXCEPTION 'Seed validation failed: seasons is empty';
  END IF;
END
$$;
