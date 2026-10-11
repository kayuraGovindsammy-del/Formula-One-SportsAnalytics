# Issue 2B — PostgreSQL-backed basic read models

> Historical integration instructions for the earlier Neon stage. The current backend
> uses Aiven PostgreSQL with verified TLS; `laps.model.ts` and `events.model.ts` have
> since moved to SQL too. Runtime reads do not load `data/sample/*.json`.
> Race statistics prefer derived lap/event values, falling back to the whole stored
> classification only when no classification can be derived, and independently to
> the stored fastest lap when none is derivable. The current setup and contract are
> [Setup](setup.md), [API Design](api-design.md) and [Data Model](data-model.md).
> The package-replacement/test-branch steps below describe that historical rollout,
> not instructions to reapply old files or bootstrap an existing database.

This change replaces the Sprint 1 sample-backed reads for:
- drivers
- constructors
- races
- sessions
- race results

It intentionally does NOT replace laps.model.ts or events.model.ts yet.
Those are handled separately because they must integrate approved submissions,
normalized event tables, and Member 1's statistics path.

Important behavior:
- Driver/race filters and pagination happen in PostgreSQL.
- Race `has_results` is based on actual `race_results`, not merely the existence
  of a session row.
- Race details now return sessions from Neon.
- Race classifications come from `race_results`.
- Fastest lap comes from `laps` only when lap timing data exists. If it does
  not, the controller must retain Member 1's derived fastest-lap value rather
  than overwriting it with null.
- Driver constructor lookup currently selects the latest season link for each
  driver. Historical season-specific constructor mapping is a later cleanup.

Testing order:
1. Apply migration 004_grid_position.sql to the Neon test branch.
2. Replace the model files in this package.
3. Apply the one small controller edit described in the patch text.
4. Run:
   npm test
   npm run build
5. Point a local backend at the Neon test branch and verify /api/v1/drivers,
   /api/v1/races and one race detail endpoint.
6. Only after successful test-branch verification should migration 004 be
   applied to production and the updated backend deployed.

Do not run schema.sql or seed.sql against an existing Neon database.
