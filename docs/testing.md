# Testing Documentation

This page describes the testing infrastructure and process that are present in the current repository at the time of writing. It is intentionally specific to this project rather than a generic software-testing guide.

## Testing Strategy

The project currently combines several layers of validation:

- Backend automated tests for services, routes, middleware, ingestion utilities, models, and the health controller.
- Frontend validation through linting and TypeScript/Vite build checks.
- Frontend Vitest/Testing Library tests with coverage, Firestore rules tests, and a Playwright end-to-end smoke suite.
- Fresh PostgreSQL schema/seed verification and isolated submission integration tests in CI.
- Documentation validation through a strict MkDocs build.
- Manual smoke testing of the deployed application and key user flows.
- Stakeholder/tutor review and a separate formal external user-testing procedure for Sprint 2.
- Sprint 2 evidence is recorded separately in `docs/user-testing/sprint2-user-testing.md`.

The manual smoke-test checklist below complements automated validation of the
[production application](index.md). Sprint 2 user-testing results are recorded
separately.

The repository contains coverage reporting for both packages and frontend tests for pages, components, clients, and route guards. Browser-level coverage remains limited to the unauthenticated login flow. The current testing approach combines:

1. automated unit/service and route-level backend testing,
2. frontend component/client tests, lint/build checks, rules tests, and a browser smoke suite,
3. documentation validation,
4. manual deployment verification,
5. stakeholder review,
6. a formal external user-testing process run separately from tutor feedback.

### Already implemented

- Backend Vitest suite (`src/backend`)
- Frontend lint and build checks (`src/frontend`)
- Frontend Vitest and Testing Library suite (`src/frontend/src/**/*.test.{ts,tsx}`)
- Frontend Firestore rules test (`src/frontend/tests/firestore.roles.test.mjs`)
- Frontend Playwright end-to-end smoke test (`src/frontend/e2e/navigation.spec.ts`)
- Strict MkDocs documentation build in CI (`.gitea/workflows/ci.yml`)

### Coverage and CI configuration

- Backend coverage reporting is now configured through `npm run test:coverage`
- Coverage output uses Vitest's V8 provider with `text`, `html`, and `json-summary` reporters
- Coverage output is written to `src/backend/coverage` and excluded from version control via `src/backend/.gitignore`
- Frontend coverage uses the same V8 reporter formats through `npm run test:ui:coverage`, writing to `src/frontend/coverage` (ignored by Git)
- CI runs frontend coverage, Firestore rules tests through the emulator, and Playwright smoke tests
- Backend CI supplies a disposable PostgreSQL test database; a separate job validates the consolidated schema and seed
- Both coverage artifact uploads use `if: always()` and `continue-on-error: true`; failed tests still fail their jobs
- Current measured coverage and run limitations are recorded in [Test Coverage](#test-coverage)
- CI does not include a dedicated dependency vulnerability scanner or SAST job

## Performance Evidence

### Backend and API

- Driver-season statistics use a constant number of database queries as the
  number of races grows. The regression tests are
  `src/backend/src/routes/driverStats.characterization.test.ts` and
  `src/backend/src/routes/driverStats.queryCount.test.ts`.
- PostgreSQL read models use a shared connection pool and indexed lookup
  columns; schema indexes are listed in `database/schema.sql`.
- List and event endpoints paginate results, with `per_page` capped at 100.
  The frontend list helpers request up to 100 rows per request.
- Jolpica ingestion uses rate handling and an on-disk HTTP response cache.
  Chat tools use a ten-minute in-process cache; provider requests have a
  15-second timeout and bounded retry/fallback behavior.

### Frontend

The application uses a Vite production build, bounded list retrieval, and
loading/error states on data-driven pages. These are implementation safeguards
for delivery and interaction; the repository does not report load-test results,
API latency benchmarks, or frontend performance measurements.

## Backend Automated Testing

### Test framework and commands

The backend uses Vitest with the Node environment.

The current backend package configuration is in `src/backend/package.json`, and the current Vitest configuration is in `src/backend/vitest.config.ts`.

Exact commands currently defined by the repository are:

```bash
cd src/backend
npm ci
npm run build
npm test
npm run test:coverage
```

`npm test` runs `vitest run`, and `npm run test:coverage` runs `vitest run --coverage`.

### Where tests live

Backend test files are spread across the application structure, including:

- `src/backend/src/services/*.test.ts`
- `src/backend/src/routes/*.test.ts`
- `src/backend/src/middleware/*.test.ts`
- `src/backend/src/models/*.test.ts`
- `src/backend/src/ingestion/*.test.ts`
- `src/backend/src/controllers/*.test.ts`
- `src/backend/src/chat/*.test.ts`
- `src/backend/src/utils/*.test.ts`

### Backend test categories currently present

The repository currently contains backend tests covering multiple layers.

Service and derivation logic tests include:

- `driverStatistics.test.ts`
- `raceStatistics.test.ts`
- `lapStatistics.test.ts`
- `pitStatistics.test.ts`
- `pointsTable.test.ts`
- `runningOrder.test.ts`
- `constructorStatistics.test.ts`
- `accountDeletion.test.ts`
- `submissionValidation.test.ts`
- `driverStandings.test.ts`

These cover statistics derivation, points logic, pit-stop logic, running order logic, submission validation, and account-deletion business rules.

Route and API behaviour tests include:

- `drivers.routes.test.ts`
- `races.routes.test.ts`
- `statistics.routes.test.ts`
- `submissions.routes.test.ts`
- `users.routes.test.ts`
- `qualifying.routes.test.ts`, `exports.routes.test.ts`, and `docs.routes.test.ts`
- `chat.routes.test.ts`
- driver-statistics characterization, ingested-fallback, and query-count regression tests

These exercise HTTP-level behaviour, query parsing, validation, route responses, and API error handling paths.

Middleware and controller tests include:

- `authorization.test.ts`
- `errorHandler.test.ts`
- `health.controller.test.ts`

These validate authorization decisions, error handling, and the health endpoint response.

Model and integration-style tests include:

- `submissions.model.test.ts`
- `submissions.integration.test.ts`
- `raceResults.model.test.ts`

These cover model behaviour and transactional approval flows. The integration
suite executes against a real local PostgreSQL database only when
`TEST_DATABASE_URL` is supplied; otherwise its nine cases skip. It refuses
non-local hosts and databases whose names do not end in `_test`, creates an
isolated temporary schema, and removes it afterwards. CI supplies this
database rather than using the shared application database.

Ingestion and utility tests include:

- `cli.test.ts`
- `httpCache.test.ts`
- `ingestSeason.test.ts`
- `jolpicaClient.test.ts`
- `rateLimiter.test.ts`
- `transform.test.ts`
- `openF1Overtakes.test.ts`, `csv.test.ts`, and `ttlCache.test.ts`

These cover argument parsing, HTTP caching, ingestion planning, external-client behaviour, rate limiting, and data transformation.

Chat tests cover message/tool validation, per-client/global limits, tool
execution, provider timeout/fallback behaviour, formatting and permitted
links. Provider calls are mocked; these tests do not prove live LLM answer
quality or provider availability.

### Backend test naming and style

The test suite uses `describe(...)` and `it(...)` from Vitest, with files named using the `*.test.ts` convention. The repository currently uses consistent naming aligned to the file being tested, such as `driverStatistics.test.ts` or `drivers.routes.test.ts`.

### Coverage status

Coverage is now configured for the backend.

The repository currently defines a `test:coverage` script in `src/backend/package.json`, and `src/backend/vitest.config.ts` configures Vitest coverage using the `v8` provider with `text`, `html`, and `json-summary` reporters. Coverage output is written to `src/backend/coverage` and is excluded from version control via `src/backend/.gitignore`.

The measured snapshot, environment, and exclusions are recorded in
[Test Coverage](#test-coverage), rather than treating an older sprint's
percentages as a current baseline.

The CI workflow attempts to upload `backend-coverage-report` from
`src/backend/coverage` even when earlier steps fail. Artifact upload failure
is non-blocking; build/test failure is blocking.

## Frontend Validation and UI Testing

### Frontend commands currently available

The current frontend scripts in `src/frontend/package.json` are:

```bash
cd src/frontend
npm ci
npm run lint
npm run build
npm run test:ui:run
npm run test:ui:coverage
npx --yes firebase-tools emulators:exec --only firestore --project demo-member4-roles "npm run test:rules"
npx playwright install --with-deps chromium
npm run test:e2e
```

The exact scripts are:

- `npm run lint` → `eslint .`
- `npm run build` → `tsc -b && vite build`
- `npm run test:rules` → `node --test tests/firestore.roles.test.mjs`
- `npm run test:e2e` → `playwright test`
- `npm run test:ui` → `vitest` (watch mode)
- `npm run test:ui:run` → `vitest run`
- `npm run test:ui:coverage` → `vitest run --coverage`

For the Playwright suite, the browser binary must be present first. In the current CI workflow this is handled by `npx playwright install --with-deps chromium`.

For the Firestore rules test, the repository uses `npx --yes firebase-tools emulators:exec --only firestore --project demo-member4-roles "npm run test:rules"`. This is required because the rules test relies on the Firestore emulator environment rather than on a manually started local emulator.

### What the frontend currently validates

The frontend currently includes:

- ESLint validation (`src/frontend/eslint.config.js`)
- TypeScript + Vite build validation (`src/frontend/package.json`)
- Vitest with jsdom, React Testing Library, user-event, and jest-dom (`src/frontend/vitest.config.ts` and `src/frontend/src/test/setup.ts`)
- A Firestore rules test (`src/frontend/tests/firestore.roles.test.mjs`)
- A Playwright end-to-end suite (`src/frontend/e2e/navigation.spec.ts`) that runs through `npm run test:e2e`

### Existing frontend automated tests

There is an actual Playwright setup in `src/frontend/playwright.config.ts`.

The current e2e suite in `src/frontend/e2e/navigation.spec.ts` contains five unauthenticated tests that verify:

1. `/` redirects an unauthenticated user to `/login` and displays the login page
2. the email and password fields are visible
3. the sign-in and Google sign-in controls are visible
4. the password reset option is visible
5. the registration option is visible

This means the repository already has a real Playwright UI suite for important unauthenticated login-page behaviour, but it is not yet a broad authenticated end-to-end suite covering post-login application flows such as drivers, races, constructors, statistics, submissions, or admin workflows.

In the current CI workflow (`.gitea/workflows/ci.yml`), the frontend job installs Chromium with `npx playwright install --with-deps chromium` and then runs `npm run test:e2e` as part of the frontend validation job.

The Firestore rules tests require the emulator and Java 21; CI explicitly
installs Temurin 21. They check private profile access, self-promotion and
self-review rejection, pending-request review transitions, rejection
reasons, and deletion markers. `npm run test:rules` alone assumes the
emulator is already running.

The Vitest UI suite covers the dashboard, driver/race/constructor pages,
statistics, qualifying and predictions, login/account, submissions/admin
review, navigation guards, downloads, API mapping, and chat. Most API/auth
dependencies are mocked. These checks therefore exercise frontend behaviour
without demonstrating real Firebase sign-in or a full browser/API/database
journey. The 20-second test timeout accommodates slower shared CI runners.

### Important distinction

Frontend validation is not the same thing as full UI testing.

The current repository has:

- lint/build validation,
- component/page/client tests with coverage,
- Firestore rules testing,
- an unauthenticated Playwright end-to-end suite that validates key login-page UI behaviour.

It does not yet contain authenticated Playwright journeys for submissions,
administration, account deletion, or analytics. Component tests cover parts
of those flows separately.

## Documentation Validation

The documentation site is configured with `mkdocs.yml` and uses `requirements-docs.txt`.

Current docs dependencies:

```text
requirements-docs.txt
mkdocs>=1.6,<2.0
```

The repository-supported strict documentation build command is:

```bash
python -m pip install -r requirements-docs.txt
mkdocs build --strict
```

This is also what the CI workflow uses in `.gitea/workflows/ci.yml`.

In strict mode, warnings are treated as failures, so the docs build is intended to be a high-quality gate rather than a permissive preview build.

## Test Coverage

Both packages configure V8 coverage with text, HTML, and JSON-summary
reports. Neither Vitest configuration enforces a percentage threshold.

The following snapshot was measured on **11 October 2026** against source
commit `08b43e7`, using Node.js `24.14.0` locally (CI uses Node.js 22):

| Suite | Statements | Branches | Functions | Lines | Result |
|---|---|---|---|---|---|
| Backend (`npm run test:coverage`) | 83.69% | 76.70% | 84.61% | 84.50% | 46 files / 684 tests passed; 1 file / 9 integration tests skipped |
| Frontend (`npm run test:ui:coverage`) | 70.63% | 59.68% | 74.22% | 72.03% | 26 files / 174 tests passed |

`TEST_DATABASE_URL` was unset for this local run, so the backend result does
not include real PostgreSQL integration execution. It also does not include
Firestore emulator or Playwright results. Reports are generated under each
package's ignored `coverage/` directory; rerun the commands to obtain a
report for another revision/environment.

Backend coverage includes `src/**/*.ts` but excludes tests, declarations,
test helpers, and `src/config/**`. Frontend coverage includes
`src/**/*.{ts,tsx}` and excludes tests, declarations, and test setup. These
percentages cannot be read as coverage of live deployments or every security
boundary.

### Behavioural coverage priorities

The existing Sprint 2 testing priorities remain useful:

- cover the statistics and derivation logic in `src/backend/src/services`
- cover API routes and error paths in `src/backend/src/routes`
- cover authorization and middleware behaviour in `src/backend/src/middleware`
- cover critical user workflows such as submission review and account-deletion flows
- add regression tests whenever a bug is discovered and the underlying behaviour was previously untested

Regression tests should verify meaningful behaviour, especially missing
authenticated journeys and provider/database failure paths.

## CI Testing Procedure

The repository includes `.gitea/workflows/ci.yml`.

The current workflow is defined for pushes to `main` and pull requests targeting `main`.

It contains four validation jobs and a dependent deployment job:

1. Frontend validation
   - installs `src/frontend` dependencies with `npm ci`
   - runs `npm run lint`
   - runs `npm run build`
   - runs `npm run test:ui:coverage` and attempts to upload `frontend-coverage-report`
   - installs Java 21 for the emulator
   - runs Firestore rules tests through `npx --yes firebase-tools emulators:exec --only firestore --project demo-member4-roles "npm run test:rules"`
   - installs Playwright Chromium with `npx playwright install --with-deps chromium`
   - runs `npm run test:e2e`

2. Backend build and coverage tests
   - installs `src/backend` dependencies with `npm ci`
   - runs `npm run build`
   - provisions and verifies a disposable PostgreSQL database, supplying `TEST_DATABASE_URL` to enable real submission integration tests
   - runs `npm run test:coverage`
   - uploads `src/backend/coverage` as the `backend-coverage-report` artifact

3. Fresh database validation
   - loads `database/schema.sql` into a fresh PostgreSQL database
   - loads `database/seed.sql`
   - executes `database/verify_schema.sql`, with `ON_ERROR_STOP=1` for every SQL file

4. Documentation validation
   - installs MkDocs dependencies from `requirements-docs.txt`
   - runs `mkdocs build --strict`

The Railway deployment job waits for all four validation jobs and runs only
on pushes to `main`. Both coverage uploads are best-effort; their failures
do not disable the test gates. Application jobs use Node.js 22, and docs use
Python 3.12. The workflow runs the listed validation jobs and gates the
Railway deployment job on their completion.

The local commands in this document are the same commands that the CI workflow expects. In other words, the CI process is reproducible locally and is intended to provide project-wide validation, while hosted execution depends on Gitea runner availability and the repository’s runtime context.

## Bug Reporting and Regression Testing

For Sprint 2, bugs should be logged as they are discovered rather than collected at the end of the sprint.

The repository bug report template is located at `.gitea/ISSUE_TEMPLATE/bug_report.md` and should be used for reproducible issues that need to stay close to code, branches, and CI evidence.

A useful bug report in this project should include:

- a clear title
- observed behaviour
- expected behaviour
- reproduction steps
- affected page, route, component, or backend area
- severity or impact
- screenshots or logs when they help explain the problem
- owner or responsible workstream where appropriate

The team should also follow a simple regression-testing rule:

- when a bug exposes a missing automated check, add or update a test where practical
- keep fixes focused on the issue being addressed
- prefer separate feature branches and pull requests for fixes

This is especially important in this repository because some statistics work and sample-data areas have known limitations that are documented separately and should not be mistaken for bugs.

### Bug severity definitions

The bug-report template uses practical severity levels suitable for a university project. Severity describes the impact of the defect; priority describes when the team chooses to address it.

- Critical: application cannot be used, severe data corruption or security/access issue, or a blocker for deployment or the core demonstration.
- High: a major core feature is broken, there is no reasonable workaround, or a serious API/auth/submission/statistics failure prevents normal use.
- Medium: a feature is partially broken, a workaround exists, or the defect causes meaningful but non-blocking disruption.
- Low: a minor UI/polish/documentation issue with limited impact or a small visible defect that does not materially affect the main workflow.

This should be used consistently when triaging issues so that the team can distinguish impact from scheduling urgency.

## Known Test Data Limitations

The current repository explicitly documents several sample-data and implementation limitations in `docs/f1-statistics.md`.

The most relevant testing-related limitations are:

- only a subset of drivers have full race and qualifying coverage in the sample event log
- several drivers have partial event coverage and therefore have trustworthy finishing positions but limited pace/consistency data
- `ANT` has only a mid-race lap snapshot, so his points and season statistics reflect that partial data rather than a full race finish
- `positions_gained_lost_avg` is only meaningful when qualifying data is present
- the fallback points calculator does not implement era-specific, fastest-lap bonus, sprint, or half-point rules; published `race_results.points` are preferred when available
- season statistics iterate Grand Prix `RACE` sessions, excluding sprint-session points even if ingested
- safety-car-aware pace/consistency logic and penalty-adjusted derived classifications remain unimplemented

This matters for testing because the team should distinguish between:

- real defects in implementation,
- intentionally incomplete features,
- sample-data trust boundaries.

## Manual Testing

Manual testing should complement, not replace, automated validation.

A concise smoke-test flow for the deployed application should cover the screens and routes currently present in the frontend, based on the application structure in `src/frontend/src/App.tsx` and the available pages in `src/frontend/src/pages`.

At minimum, the deployed application should be checked for:

- homepage/dashboard load
- drivers list and driver detail pages
- constructors page
- races list and race detail pages
- statistics page
- qualifying and frontend prediction pages (including missing qualifying/statistics data)
- CSV/JSON downloads and the F1 Assistant, including errors/retry and sign-out reset
- account page
- login/auth flow
- submitter submission workflow
- admin review pages for submitter requests and submissions
- deployed API responsiveness from the frontend and directly through the backend routes

The goal of manual testing is to confirm that the deployed app behaves correctly from a user’s point of view and that the automated checks line up with the actual experience.

## External User Testing Process

Sprint 2 should treat external user testing as a separate process from tutor/stakeholder review.

A formal external user-testing procedure for this project should include:

1. recruiting users who are not members of the project team and are not the tutor/client
2. providing them with a short set of representative tasks
3. allowing them to use the deployed application without guidance beyond the task brief
4. collecting feedback through a structured form or equivalent evidence capture
5. recording usability issues, suggestions, and blockers as they arise
6. prioritising actionable feedback
7. implementing selected changes in focused work
8. preserving evidence of before/after changes where the feedback leads to a product update

This is distinct from stakeholder review because external user testing is aimed at usability, task completion, and real-world user comprehension of the application, whereas stakeholder review is closer to requirement alignment, project direction, and delivery feedback.

## Stakeholder Review

Tutor or stakeholder review is a separate process from external user testing.

Meeting records should capture:

- date
- attendees
- feedback received
- decisions taken
- action items
- evidence that relevant feedback was subsequently acted on

Stakeholder feedback and meeting outcomes are distinct from external user-testing results and are recorded separately from automated test output.

## Evidence Retained for Sprint 2

The team should retain evidence that supports the testing story for Sprint 2. The most useful evidence in this repository would include:

- automated test output from backend Vitest runs
- frontend lint, build, rules-test, and Playwright output
- the repository-defined CI workflow (`.gitea/workflows/ci.yml`)
- MkDocs strict-build output
- issue history and bug reports in Gitea where available
- pull requests and review comments
- deployed application screenshots or notes from manual smoke testing
- external user-feedback responses and any implemented follow-up changes
- tutor/stakeholder meeting notes and recorded actions

This gives the team a clear trail from implementation through validation and review.

## Summary

The current project has backend and frontend automated suites with measured
coverage, Firestore rules tests, five Playwright login checks, fresh-database
validation, and strict documentation validation. The Playwright suite does not
cover authenticated browser journeys, and automated tests do not evaluate live
LLM answer quality.
