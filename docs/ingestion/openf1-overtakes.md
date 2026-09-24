# OpenF1 overtake / position-change ingestion

The core season importer uses Jolpica for calendar, results, pit stops and retirements. Jolpica does not expose a dedicated overtake feed, so `position_changes` is populated separately from OpenF1.

## Source semantics

OpenF1's `overtakes` endpoint records exchanges of position. Its own documentation notes that these can include on-track passes as well as position changes caused by pit stops or post-race penalties, and that the feed may be incomplete. For that reason, rows are stored in the existing `position_changes` table and should be interpreted as recorded position exchanges rather than a guaranteed FIA-grade count of on-track passes.

OpenF1 historical data is available from 2023 onward. The public historical tier requires no authentication. The importer deliberately spaces requests to remain below the public rate limit.

## Command

From `src/backend`:

```powershell
npm run ingest:overtakes -- --season 2025 --dry-run
```

The dry run reads the existing database so it can map race sessions and driver numbers, but does not write `position_changes`.

After reviewing the planned count and warnings:

```powershell
npm run ingest:overtakes -- --season 2025
```

## Mapping

- Database race sessions are matched to OpenF1 Race sessions by race date, allowing a one-day UTC rollover for night races.
- OpenF1 car numbers are mapped to `drivers.permanent_number`, which the season result ingest already writes from the number actually used that season.
- OpenF1 provides the overtaking driver, overtaken driver and the overtaker's position after the exchange.
- The importer assigns `position_before = position_after + 1`, matching the existing `POSITION_CHANGE` event model for a single exchange.
- OpenF1 does not provide a lap number in the overtake row. The importer resolves it from that driver's OpenF1 lap start timestamps.

## Idempotency and reviewed submissions

Before writing, the importer deletes only source rows (`submission_id IS NULL`) for the selected season's Race sessions. Reviewed submission rows are preserved. A source row is skipped when a reviewed submission already represents the same driver/overtaken-driver/lap exchange.

Re-running the command therefore rebuilds only the external-source portion of `position_changes` and does not overwrite approved user submissions.
