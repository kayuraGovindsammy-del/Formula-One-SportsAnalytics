# Testing Documentation

This page describes the testing infrastructure and process that are present in the current repository at the time of writing. It is intentionally specific to this project rather than a generic software-testing guide.

## Testing Strategy

The project currently combines several layers of validation:

- Backend automated tests for services, routes, middleware, ingestion utilities, models, and the health controller.
- Frontend validation through linting and TypeScript/Vite build checks.
- Frontend automated checks in the form of a Firestore rules test and a Playwright end-to-end smoke test.
- Documentation validation through a strict MkDocs build.
- Manual smoke testing of the deployed application and key user flows.
- Stakeholder/tutor review and a separate formal external user-testing procedure for Sprint 2.

In practical terms, the repository already contains meaningful automated validation for the backend and some automated frontend checks, but it does not yet contain full coverage reporting or a fully expanded UI test suite. The current testing approach should therefore be understood as a combination of:

1. automated unit/service and route-level backend testing,
2. frontend lint/build validation and a small UI smoke test,
3. documentation validation,
4. manual deployment verification,
5. stakeholder review,
6. a formal external user-testing process run separately from tutor feedback.

### Already implemented

- Backend Vitest suite (`src/backend`)
- Frontend lint and build checks (`src/frontend`)
- Frontend Firestore rules test (`src/frontend/tests/firestore.roles.test.mjs`)
- Frontend Playwright end-to-end smoke test (`src/frontend/e2e/navigation.spec.ts`)
- Strict MkDocs documentation build in CI (`.gitea/workflows/ci.yml`)

### Planned / being added during Sprint 2

- Expanded coverage reporting
- Broader UI coverage for key user journeys
- More explicit regression-test capture for bugs found during testing
- Structured evidence collection for external user testing and stakeholder review

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
```

`npm test` runs `vitest run`.

### Where tests live

Backend test files are spread across the application structure, including:

- `src/backend/src/services/*.test.ts`
- `src/backend/src/routes/*.test.ts`
- `src/backend/src/middleware/*.test.ts`
- `src/backend/src/models/*.test.ts`
- `src/backend/src/ingestion/*.test.ts`
- `src/backend/src/controllers/*.test.ts`

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

These cover statistics derivation, points logic, pit-stop logic, running order logic, submission validation, and account-deletion business rules.

Route and API behaviour tests include:

- `drivers.routes.test.ts`
- `races.routes.test.ts`
- `statistics.routes.test.ts`
- `submissions.routes.test.ts`
- `users.routes.test.ts`

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

These cover model behaviour, transactional approval flows, and a more integrated database-oriented model test.

Ingestion and utility tests include:

- `cli.test.ts`
- `httpCache.test.ts`
- `ingestSeason.test.ts`
- `jolpicaClient.test.ts`
- `rateLimiter.test.ts`
- `transform.test.ts`

These cover argument parsing, HTTP caching, ingestion planning, external-client behaviour, rate limiting, and data transformation.

### Backend test naming and style

The test suite uses `describe(...)` and `it(...)` from Vitest, with files named using the `*.test.ts` convention. The repository currently uses consistent naming aligned to the file being tested, such as `driverStatistics.test.ts` or `drivers.routes.test.ts`.

### Coverage status

Coverage tooling is not currently configured in the repository.

The current backend `vitest.config.ts` only sets the test environment to `node` and excludes `dist` and `node_modules`. There is no `coverage` block, no coverage script in `src/backend/package.json`, and no repository-defined coverage threshold.

Sprint 2 is therefore the stage where coverage reporting should be documented as a planned infrastructure addition rather than as an already implemented feature.

## Frontend Validation and UI Testing

### Frontend commands currently available

The current frontend scripts in `src/frontend/package.json` are:

```bash
cd src/frontend
npm ci
npm run lint
npm run build
npm run test:rules
npm run test:e2e
```

The exact scripts are:

- `npm run lint` → `eslint .`
- `npm run build` → `tsc -b && vite build`
- `npm run test:rules` → `node --test tests/firestore.roles.test.mjs`
- `npm run test:e2e` → `playwright test`

### What the frontend currently validates

The frontend currently includes:

- ESLint validation (`src/frontend/eslint.config.js`)
- TypeScript + Vite build validation (`src/frontend/package.json`)
- A Firestore rules test (`src/frontend/tests/firestore.roles.test.mjs`)
- A Playwright end-to-end smoke test (`src/frontend/e2e/navigation.spec.ts`)

### Existing frontend automated tests

There is an actual Playwright setup in `src/frontend/playwright.config.ts`.

The existing e2e suite currently contains a single smoke test file, `src/frontend/e2e/navigation.spec.ts`, which verifies that the unauthenticated login page loads and exposes the expected sign-in controls.

This means the project does already have a UI smoke test in place, but it is not yet a comprehensive frontend test suite. It is best understood as a small end-to-end check of the login page and key unauthenticated navigation elements.

### Important distinction

Frontend validation is not the same thing as full UI testing.

The current repository has:

- lint/build validation,
- Firestore rules testing,
- Playwright e2e smoke coverage for a limited user path.

It does not yet contain a broad, project-wide frontend test suite covering every major user journey or browser-level business flow.

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

Coverage is not currently configured in the repository.

There is no coverage script in `src/backend/package.json`, no `coverage` configuration in `src/backend/vitest.config.ts`, and no frontend coverage tooling is currently defined in the frontend package.

### Coverage policy to document for Sprint 2

Until coverage tooling is added, the team should treat coverage as a policy goal rather than as a measured number.

A sensible Sprint 2 coverage policy for this repository is:

- cover the statistics and derivation logic in `src/backend/src/services`
- cover API routes and error paths in `src/backend/src/routes`
- cover authorization and middleware behaviour in `src/backend/src/middleware`
- cover critical user workflows such as submission review and account-deletion flows
- add regression tests whenever a bug is discovered and the underlying behaviour was previously untested

The important point is that meaningful behavioural coverage matters more than chasing a percentage alone. Once coverage tooling is added later, this document can be updated with the exact command, report location, and any configured thresholds.

## CI Testing Procedure

The repository includes `.gitea/workflows/ci.yml`.

The current workflow is defined for pushes to `main` and pull requests targeting `main`.

It contains three jobs:

1. Frontend lint and build
   - installs `src/frontend` dependencies with `npm ci`
   - runs `npm run lint`
   - runs `npm run build`

2. Backend build and tests
   - installs `src/backend` dependencies with `npm ci`
   - runs `npm run build`
   - runs `npm test`

3. Documentation validation
   - installs MkDocs dependencies from `requirements-docs.txt`
   - runs `mkdocs build --strict`

The workflow therefore defines a clean repository-level validation pipeline for the core parts of the project.

The local commands in this document are the same commands that the CI workflow expects. In other words, the CI process is reproducible locally and is intended to provide project-wide validation, while hosted execution depends on Gitea runner availability and the repository’s runtime context.

## Bug Reporting and Regression Testing

For Sprint 2, bugs should be logged as they are discovered rather than collected at the end of the sprint.

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

## Known Test Data Limitations

The current repository explicitly documents several sample-data and implementation limitations in `docs/f1-statistics.md`.

The most relevant testing-related limitations are:

- only a subset of drivers have full race and qualifying coverage in the sample event log
- several drivers have partial event coverage and therefore have trustworthy finishing positions but limited pace/consistency data
- `ANT` has only a mid-race lap snapshot, so his points and season statistics reflect that partial data rather than a full race finish
- `positions_gained_lost_avg` is only meaningful when qualifying data is present
- some statistics are intentionally not implemented yet, such as fastest-lap bonus points, sprint-session points, safety-car-aware pace/consistency logic, and penalty-adjusted classification handling

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

The team should not fabricate meetings or imply feedback was received if it is not recorded in the project evidence.

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

The current repository already contains a solid backend test suite, a small but real frontend UI smoke test, frontend lint/build checks, and strict documentation validation through MkDocs. What it does not yet contain is broad coverage reporting and a full frontend test suite covering every user journey.

That is a realistic and accurate state for Sprint 2: the project already has automated testing in place, but it still has room to extend both the automated coverage and the formal evidence-gathering process.
