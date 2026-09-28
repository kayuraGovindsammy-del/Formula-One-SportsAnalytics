# F1 Analytics Backend — constraints for AI assistance

## Never violate
- Hand-written API only. No endpoint-generating services.
- Statistics are DERIVED from event records. Never return stored
  totals in place of derivation output.
  EXCEPTION: `race_results.points`, per session, in
  driverStatistics.ts. Jolpica writes it straight from the source and
  it already applies era/sprint/half-point rules pointsTable.ts does
  not implement, so it is a published fact, not a derived statistic
  (docs/ingestion/jolpica-ingestion.md §4.2) — preferred over the
  derived P1-P10 scale when a row exists, which also falls back to
  when it doesn't. Don't generalize this to other fields without the
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
  Test Files  34 passed | 1 skipped (35)
       Tests  446 passed | 9 skipped (455)
Any change that reduces the passing count is a regression, not a
flaky test.

Update this block in the same commit as any change to the count, or
the next person has no baseline to judge a regression against.
