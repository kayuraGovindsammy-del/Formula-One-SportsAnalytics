# F1 Analytics Backend — constraints for AI assistance

## Never violate
- Hand-written API only. No endpoint-generating services.
- Statistics are DERIVED from event records. Never return stored
  totals in place of derivation output.
  EXCEPTION: published `race_results` facts, per session, in
  driverStatistics.ts. Jolpica writes them straight from the source, so
  they are published facts, not derived statistics
  (docs/ingestion/jolpica-ingestion.md §4.2). Two tiers:
  - `points` is PREFERRED over the derived P1-P10 scale whenever a row
    exists (it already applies era/sprint/half-point rules
    pointsTable.ts does not implement), falling back to the derived
    scale when it doesn't.
  - `position`, `grid_position` and the `fastest_lap_rank = 1` flag are
    FALLBACK ONLY: laps always win, and these are read solely when the
    driver (position, grid) or the whole session (fastest lap) has no
    lap data — the shape of every Jolpica-ingested race. They feed
    wins, podiums, average_finish_position, positions_gained_lost_avg
    and fastest_laps. Derived qualifying positions beat
    `grid_position`, and `grid_position` 0 (a pit-lane start) is
    skipped, never guessed at.
  The position used is the raw nullable `classified_position`, never
  `position`: the model's `position` falls back to the row's ordinal so
  classifications render, and would invent finishes for retirements.
  average_race_pace_ms stays lap-derived only — no published fact can
  stand in for it. Don't generalize this to other fields without the
  same "published fact, not a derived statistic" reasoning.
  The same exception covers constructorStatistics.ts, which sums those
  same published values per season, grouped by each row's own
  `race_results.constructor_id`. Summing published facts per request
  does not store a total, and team attribution must come from the
  result row rather than `driver_constructor_links` — that table is
  season-level with no date range, so it cannot say which team a
  driver scored for in a given race.
- Raw SQL via pg.Pool. No ORM — the project deliberately has none.
- ESM + NodeNext. Use .js extensions in relative imports.
- strict + noUncheckedIndexedAccess are on. Array access is
  possibly-undefined; handle it, never cast it away with ! or as.

## Conventions
- Success: { data, meta }. Error: { error: { code, message } }.
- routes -> controllers -> models. Services stay pure: no I/O, no Express.
- Every new endpoint needs a Supertest test in src/routes/.
- All routes are mounted under /api/v1.

## Baseline
`npm test` in src/backend reports:
  Test Files  32 passed | 1 skipped (33)
       Tests  409 passed | 9 skipped (418)
Any change that reduces the passing count is a regression, not a
flaky test.

Update this block in the same commit as any change to the count, or
the next person has no baseline to judge a regression against.
