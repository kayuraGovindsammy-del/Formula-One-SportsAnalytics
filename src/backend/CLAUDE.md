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
125 tests across 10 files pass on main. Any change that reduces
that number is a regression, not a flaky test.
