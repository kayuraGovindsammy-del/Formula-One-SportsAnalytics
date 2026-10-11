# Member 4 — Stage 4: Submission validation and persistence

> Historical Stage 4 handoff and verification plan. The Neon/package instructions below
> describe its baseline; the current backend uses Aiven PostgreSQL with verified TLS.
> The SQL submission workflow is integrated with public reads: `laps.model.ts` reads
> normalized laps and `events.model.ts` combines accepted envelopes with only
> source/legacy normalized rows (`submission_id IS NULL`), avoiding duplicate counting.
> Public statistics read those models per request. Chat's separate ten-minute cache
> has no publication-triggered invalidation. The current review API accepts at most one
> reason of 2,000 characters, requires a reason for rejection and none for acceptance.
> See [API Design](api-design.md), [Setup](setup.md) and [Testing](testing.md) for current
> contracts/configuration and execution evidence. The historical generation limitations
> below do not claim that the current suite has or has not passed.

Baseline: SportsAnalytics(20260909-104712).zip plus the working Stage 1,
Stage 2 and Stage 3 changes. This is a focused manual replacement package,
not the older all-in-one Sprint 2 package.

## Scope and ownership

This stage implements submission schema validation, Neon persistence,
ownership-filtered history, administrator approval/rejection, reviewer
traceability, duplicate prevention and atomic publication into normalized
event tables. It preserves the existing Firebase authentication, Firestore
roles, account-deletion service, Railway API and Azure frontend architecture.

The existing Stage 2 deletion migration is 002_account_deletion.sql.
This stage adds 003_submissions.sql. Do not rename, rerun, or replace migration
002. No Firebase rule changes or new npm dependencies are required.

Only the included files should be replaced. Preserve any newer teammate
changes in shared files. In particular, do not replace the whole repository,
run git reset, overwrite .env files, or copy the older replacement package.
You can continue without committing until the end, as requested.

## What the API now does

POST /api/v1/submissions
  Approved SUBMITTER or ADMIN only. Strictly validates the event envelope
  and type-specific payload, confirms session/driver references, prevents
  duplicate pending/accepted event IDs and creates a PENDING SQL row.
  Nothing is published to normalized event tables while pending.

GET /api/v1/submissions
  ADMIN sees all submissions; approved SUBMITTER sees only their own.
  Optional status=pending|accepted|rejected.

GET /api/v1/submissions/mine
  Any authenticated user sees only their own history, including after
  submitter access is revoked. Optional status filter.

GET /api/v1/submissions/:submission_id
  The owner or ADMIN only.

PATCH /api/v1/submissions/:submission_id
  ADMIN only. Accepts the existing API contract:
  {"status":"accepted","validation_errors":[]}
  or {"status":"rejected","validation_errors":["Reason"]}.
  Rejection requires a reason. A reviewed record cannot be reviewed again.

Approval locks the pending row, revalidates stored JSON, checks references,
publishes the accepted envelope and normalized data, then records the status,
reviewer and time in one PostgreSQL transaction. A conflict rolls everything
back. The full accepted envelope remains in accepted_events; fastest-lap
markers do not create duplicate completed-lap rows. Rejection publishes
nothing and retains the original event and review reason.

## Database migration

Apply database/migrations/003_submissions.sql only after migration 002.
It creates accepted_events and supporting indexes. It does not delete,
rewrite or backfill existing data. Existing legacy accepted submissions
remain untouched; this package does not claim that they have been published
into the new accepted_events table.

Use the existing member4-deletion-test Neon branch first. Confirm the selected
database contains the existing Sprint 1 tables and account_deletions. In the
SQL Editor, run only the new migration. Then verify:

SELECT to_regclass('public.accepted_events');

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'accepted_events'
ORDER BY ordinal_position;

SELECT COUNT(*) AS accepted_event_count FROM accepted_events;

The new table should initially be empty. Do not rerun schema.sql or seed.sql
on your existing Neon database. Do not manually insert accepted events.

## Local checks (no production database writes)

From src/backend:
  npm test
  npm run build

From src/frontend:
  npm install
  npm run build
  npm run lint

The new route/model tests mock PostgreSQL and authentication. The validation
tests cover all eight event types and invalid data. The real PostgreSQL
integration suite is optional and skipped unless TEST_DATABASE_URL is set.

The source was checked with TypeScript syntax/transpilation, but the full npm
build, Vitest suites and real PostgreSQL integration suite could not be run
in the generation environment because npm package downloads failed. Run
these checks on your machine before declaring the feature complete.

## Optional isolated PostgreSQL integration tests

The integration suite deliberately refuses Neon or other non-local hosts.
It requires a local PostgreSQL database whose name ends in _test, creates a
random disposable schema, verifies search_path isolation, and drops only that
generated schema afterward. It must never run against production or a shared
Neon database.

Install/start a local PostgreSQL instance and create a disposable database
such as f1_member4_test. Set TEST_DATABASE_URL privately in your terminal.
Then run from src/backend:
  npx vitest run src/models/submissions.integration.test.ts

Do not paste connection strings into chat or commit them. If you do not have
local PostgreSQL installed, skip this optional suite and use the Neon test
branch for the manual integration checks below.

## Manual integration on the Neon TEST branch

After the test-branch migration succeeds, start a LOCAL backend with its
DATABASE_URL temporarily pointing to the test-branch connection string.
Do not change the production Railway DATABASE_URL. Do not paste credentials
into chat. A PowerShell environment variable takes precedence over dotenv.

Use the existing Firebase project and disposable USER/SUBMITTER test accounts.
The local frontend should point VITE_API_BASE_URL to
http://localhost:3001/api/v1 while testing the local backend.

1. Submit a valid event and confirm a PENDING record exists in Neon.
2. Confirm the event is absent from accepted_events and normalized tables.
3. Check My Submissions as its owner and verify another user cannot see it.
4. As ADMIN reject a submission with a reason and verify history.
5. Submit a separate valid event, approve it, and verify accepted_events,
   the relevant normalized table, submission_id, reviewer and review time.
6. Attempt a second review and a duplicate event ID; both must be rejected.
7. Submit an event that conflicts with an existing normalized lap and verify
   its approval rolls back, leaving it PENDING with no accepted envelope.
8. Test invalid payloads and nonexistent session/driver IDs.
9. Confirm ordinary/pending users cannot submit or review, and an approved
   submitter cannot open another owner's submission.

Use a disposable event ID such as evt_member4_test_<random> and an existing
test-branch session/driver. Do not invent live race facts or overwrite real
race results. Do not delete real accounts or production data.

## Production rollout (only after test-branch verification)

Coordinate with Member 2 and the team. Back up Neon, apply only migration 003
to production, then deploy the updated backend to the existing Railway service
from the repository root with railway up. Verify the deployment and existing
health endpoint. The new frontend can be tested locally against the deployed
API, and will be published through the existing Azure DevOps pipeline after
your final Gitea commit/merge. No commit is required now.

Do not deploy the backend before the production migration: the new endpoints
refer to accepted_events. Do not direct automated integration tests at Neon
production.

## Teammate integration boundary

The original race/event/lap read models are still sample-backed in the
uploaded baseline. This package does not overwrite Member 2's SQL/API work or
Member 1's statistics engine. Approved events are now persisted in Neon, but
that alone does not prove that public race endpoints and statistics have
switched to the new records.

Member 2 should read accepted_events.event_data and normalized tables through
the database layer, preserve the event API contract and deterministic ordering,
and avoid counting the same event twice when merging sample and SQL data.
Member 1 can then verify derived statistics using the accepted event stream.
Do not claim the public statistics are live until those integrations and
recalculation tests have passed.

The full event envelope is retained for session boundaries and FASTEST_LAP_SET.
The normalized table schema does not contain every optional payload field
(e.g. tyre compounds); those remain available in event_data. Historical
corrections/replacements and any cache invalidation strategy should be agreed
with Members 1 and 2 before implementation.

## Files included

- database/migrations/003_submissions.sql
- src/backend/src/controllers/submissions.controller.ts
- src/backend/src/models/submissions.integration.test.ts
- src/backend/src/models/submissions.model.test.ts
- src/backend/src/models/submissions.model.ts
- src/backend/src/routes/submissions.routes.test.ts
- src/backend/src/routes/submissions.routes.ts
- src/backend/src/services/submissionValidation.test.ts
- src/backend/src/services/submissionValidation.ts
- src/backend/src/types/submission.types.ts
- src/frontend/src/App.tsx
- src/frontend/src/api/submissions.ts
- src/frontend/src/components/layout/Navbar.tsx
- src/frontend/src/pages/Admin/SubmissionReview.tsx
- src/frontend/src/pages/Submit/MySubmissions.tsx
- src/frontend/src/pages/Submit/SubmitData.tsx
