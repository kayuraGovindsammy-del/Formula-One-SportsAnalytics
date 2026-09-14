# F1 Analytics Backend — constraints for AI assistance

## Never violate
- Hand-written API only. No endpoint-generating services.
- Statistics are DERIVED from event records. Never return stored
  totals in place of derivation output.
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
  Test Files  26 passed | 1 skipped (27)
       Tests  345 passed | 9 skipped (354)
Any change that reduces the passing count is a regression, not a
flaky test.

Update this block in the same commit as any change to the count, or
the next person has no baseline to judge a regression against.
