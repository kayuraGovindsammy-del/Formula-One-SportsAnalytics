# Member 4 — Account deletion (Stage 2)

> Historical Stage 2 handoff and verification plan. Neon references and replacement
> instructions below describe that baseline; the current service uses Aiven PostgreSQL
> with verified TLS. Account deletion remains `DELETE /api/v1/users/me`, with a recent
> Firebase login, SQL/Firestore tombstones, contact-field anonymization and retained
> submission relationships. The runtime worker retries at startup and every minute
> when `DATABASE_URL` is set, processing up to 50 pending requests per pass. The current
> route returns `204` when complete or `202` when cleanup remains pending. Use
> [Setup](setup.md), [Authentication workflow](auth-and-submission-workflow.md) and
> [Testing](testing.md) for current configuration and test results.

Baseline: SportsAnalytics(20260909-104712).zip plus the working Stage 1 authentication replacements.
This is a focused manual implementation. It is NOT the older Sprint2_Member4_Replacement_Files.zip.

## Apply the complete replacements

Copy the contents of this archive into the existing SportsAnalytics repository, merging
folders and replacing only the files in the manifest below. Keep your real .env files,
local node_modules, current Git history and teammate changes. Do not replace the whole repo.
Inspect git status and preserve any existing edits before copying.

## Architecture

Firebase Authentication manages Google and email/password identities. Firestore stores
profiles, roles and a server-owned deletion marker. Railway hosts the Express API. Neon
stores users and submissions. Azure hosts the React frontend. No new service is required.

DELETE /api/v1/users/me accepts the authenticated Firebase ID token only. It requires
authentication within the last five minutes and never accepts a target UID from the body.
The frontend reauthenticates with the user's password or Google popup first.

The backend records a durable SQL deletion request before irreversible provider calls.
A protected Firestore marker prevents profile recreation with a cached ID token. The
backend then deletes the Firebase identity/profile, anonymizes Neon contact fields and
roles, and marks cleanup complete. User IDs and submission foreign keys remain stable.
A retry worker handles partial provider failures. All application authentication reads
consult deletion tombstones, and submission user upserts are serialized with deletion.

## Important retention limitation

This implementation is pseudonymization, not an assertion that every trace of a person
has been erased. The original Firebase UID remains in restricted SQL/Firestore tombstones
to prevent resurrection; historical sports submissions and contributor/reviewer IDs
remain for traceability. Review legacy JSONB event data, logs, backups, retention periods,
and applicable privacy requirements before claiming complete erasure. Do not use real
personal accounts for testing.

## Local verification

From src/backend:
  npm ci
  npm test
  npm run build

From src/frontend:
  npm ci
  npm run build
  npm run lint
  npm run dev

The historical implementation tests used mocked Firebase/SQL dependencies. The complete
npm suite, real PostgreSQL integration, and Firebase emulator tests are covered in the
current [Testing](testing.md) documentation.

A local backend needs your existing private credentials and a safe test database. Do not
paste or commit secrets. Do not run deletion tests against a real teammate/admin account.

## Safe deployment sequence (do not perform until local tests and review pass)

1. Create a Neon database branch/backup from the existing database.
2. Apply database/migrations/002_account_deletion.sql to that test branch first.
   Verify the table and test the complete cleanup with disposable accounts.
3. Test the updated firestore.rules in the Firebase emulator. Confirm ordinary users
   cannot change roles, clear deletionPending, delete their profile directly, or access
   accountDeletions; admins retain the intended approval permissions.
4. Have the team review the shared authentication, submission-model, and rules changes.
5. When ready for the live rollout, back up Neon and apply ONLY the additive migration.
   Do not rerun schema.sql, seed.sql, or an old replacement-package migration.
6. Publish the verified Firestore rules to the existing Firebase project, then deploy
   the merged backend to the existing Railway service and the frontend through the
   existing Azure DevOps pipeline. Coordinate the rollout so users do not test deletion
   during a partially upgraded deployment.
7. Use disposable accounts to verify completed deletion, pending cleanup/retry,
   failed reauthentication, Google and email/password flows, blocked deleted identities,
   retained submission history, and ordinary/admin role behavior.
8. Record the results and peer review in your Sprint 2 testing and methodology evidence.

The migration creates no new database, does not delete existing race/submission records,
and is additive. It also upgrades a minimal existing account_deletions table if present.

## Neon verification SQL

SELECT to_regclass('public.account_deletions');

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'account_deletions'
ORDER BY ordinal_position;

Do not paste the live DATABASE_URL into chat or commit it to Gitea.

## Files

- database/migrations/002_account_deletion.sql
- firestore.rules
- src/backend/src/index.ts
- src/backend/src/middleware/authenticate.ts
- src/backend/src/models/submissions.model.ts
- src/backend/src/routes/index.ts
- src/backend/src/routes/users.routes.test.ts
- src/backend/src/routes/users.routes.ts
- src/backend/src/scripts/cleanupAccounts.ts
- src/backend/src/services/accountDeletion.test.ts
- src/backend/src/services/accountDeletion.ts
- src/frontend/src/auth/AuthContext.tsx
- src/frontend/src/auth/context.ts
- src/frontend/src/pages/Auth/Account.tsx
- src/frontend/src/pages/Auth/Login.tsx
