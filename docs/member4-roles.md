# Member 4 — Stage 3: Roles and submitter approval

Baseline: SportsAnalytics(20260909-104712).zip, plus the working Stage 1 and Stage 2 changes.
Do not use the older all-in-one replacement package.

This stage completes the USER -> pending -> approved/rejected workflow. It preserves
Google/email authentication, backend-managed account deletion, Neon, Railway and Azure.
There is no new Neon migration and no new Railway endpoint in this stage.

## Apply

Copy the included files into the existing repository, merging folders and replacing
only matching files. Preserve any teammate changes in shared files. In particular,
Account.tsx is based on the Stage 2 version and retains its deletion UI.

The backend authorization.ts is not replaced because its existing checks already
require ADMIN or an approved SUBMITTER. A new test file verifies those checks.

## Changes

- USER accounts may request submitter access, and rejected users may reapply.
- Firestore transactions prevent competing administrators from reviewing stale requests.
- Administrators can approve/reject pending USER requests with reviewer metadata.
- Rejection requires a reason; users cannot approve themselves or change their roles.
- Security rules restrict the exact permitted fields and role transitions.
- Arbitrary ADMIN promotion is not offered to client applications. Provision initial
  administrators using trusted Firebase Admin tooling, never by changing your own profile.
- Account deletion markers, blocked profile recreation and backend deletion remain intact.

## Local checks

From src/backend:
  npm test
  npm run build

From src/frontend:
  npm install
  npm run build
  npm run lint

The updated frontend/package.json adds only the Firestore rules testing dependency
and the test:rules script. npm install synchronizes your existing package-lock.json.
Keep that updated lockfile for the final commit. Do not replace it with an older lockfile.

## Security rules emulator

Use a Java installation supported by your Firebase CLI. Check:
  java -version

From the repository root, run:
  firebase emulators:exec --only firestore --project demo-member4-roles "npm run test:rules --prefix src/frontend"

The demo project ID is intentional. These tests create and delete only emulator data.
They must not use your production Firebase project or live accounts. The tests cover
self-promotion, non-admin reviews, valid approval/rejection, reapplication, private
profiles, deleted-account resurrection, pending deletion and duplicate reviews.

## Deployment

Do not publish the new rules until the emulator tests pass. The live rules are currently
the working Stage 2 version; this package replaces their role-management portion.

When the tests pass, deploy only the rules to the existing Firebase project:
  firebase deploy --only firestore:rules --project sports-analytics-f1

Run the frontend locally to test the workflow using disposable accounts. The application
uses the existing Firebase project for these manual tests, so create only test accounts
and do not delete any real user or administrator.

The existing Railway API is already deployed and does not need railway up for this
stage. The frontend will be published through Azure DevOps after your final Gitea
commit/merge, as you requested. No Git commit or branch change is required now.

## Test account setup

Use one existing trusted ADMIN and two disposable USER accounts. Verify:
- USER requests access; the administrator sees the pending request.
- A USER cannot enter the admin page or approve themselves.
- An admin rejects with a reason; the USER can request again.
- An admin approves; the user's role updates to SUBMITTER/approved.
- Approved submitters can access /submit but not /admin/submissions.
- Ordinary and pending users cannot call protected submission API operations.
- A second review is rejected, and deletion-pending users cannot be approved.

Record screenshots and test results for the Sprint 2 testing documentation.
Do not modify the production database or create another Firebase project.

## Verification performed during package preparation

The four TypeScript/TSX replacements passed a syntax/transpilation check.
An isolated in-memory harness exercised the actual role service, including requests,
rejections, resubmission, approval, metadata, and invalid-role/duplicate/deletion guards.
The complete frontend build, backend Vitest suite and Firestore emulator suite have not
been run in this environment; your local results are required before deployment.

## Included files

- firestore.rules
- src/backend/src/middleware/authorization.test.ts
- src/frontend/package.json
- src/frontend/src/auth/submitterAccess.ts
- src/frontend/src/pages/Admin/SubmitterRequests.tsx
- src/frontend/src/pages/Auth/Account.tsx
- src/frontend/tests/firestore.roles.test.mjs
