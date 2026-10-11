# Sprint 3 Delivery Evidence

This page records implemented work supported by the repository and Git history. It complements the [Sprint 1 retrospective](sprint1-retrospective.md) and [Sprint 2 user-testing evidence](../user-testing/sprint2-user-testing.md); it does not invent a team retrospective or stakeholder feedback.

## 1. Scope and sprint attribution

Commit `af8bab5` and PR #92 explicitly identify Member 4's work as Sprint 3. PR #111 also names the `update/sprint3-frontend-changes` branch. The related late-September changes below are grouped with that delivery period using reachable `main` history. Exact sprint start/end dates and a Taiga backlog export are not committed, so this grouping does not establish an official schedule or exact attribution for every change.

## 2. Implementation evidence

| Workstream | Implemented change | Supporting history and files |
| --- | --- | --- |
| Database connectivity | Support for Aiven PostgreSQL and documented CA certificate setup. | `300fd2a` (PR #81), `9a4b0ee` / `fd57dd3` (PR #108); `src/backend/src/config/database.ts`, [Local Setup](../setup.md). |
| Standings and statistics correctness | Constructor standings were wired to the frontend; driver/constructor totals prefer ingested points, and constructor points are attributed to the team recorded for each race. Wins, podiums, and average finish also fall back to classification data when ingested races lack laps. | PRs #83, #85, #87, #89, #106, #123; `src/backend/src/services/constructorStatistics.ts`, `src/frontend/src/pages/Constructors/Constructors.tsx`, `src/backend/src/routes/driverStats.ingestedFallback.test.ts`. |
| Statistics performance | Driver-season statistics load season data in a constant number of queries, supported by characterization and query-count tests. | `6024aa8`, `d2a707f` (PR #107); `src/backend/src/routes/driverStats.characterization.test.ts`, `src/backend/src/routes/driverStats.queryCount.test.ts`. |
| Overtake ingestion and authentication tests | OpenF1 overtake ingestion, its CLI and tests, and expanded Firebase authentication middleware tests were added. | `af8bab5` (PR #92); `src/backend/src/ingestion/openF1Overtakes.ts`, `src/backend/src/scripts/ingestOvertakes.ts`, `src/backend/src/middleware/authenticate.test.ts`; [OpenF1 Overtakes](../ingestion/openf1-overtakes.md). |
| Dataset downloads | CSV/JSON export endpoints and frontend download controls were introduced, including season-result downloads on the Races page. | `b3ee103`, `0dccd03`, `80e28f8` (PR #124); `src/backend/src/routes/exports.routes.ts`, `src/frontend/src/components/DatasetDownloads.tsx`. |
| Frontend behavioural coverage | Login, submission, admin-review, browsing/detail pages, data mapping, and constructor standings received Vitest tests; frontend V8 coverage was added. | `1d4e651` (PR #111), PRs #117, #119, #121, #125; `src/frontend/vitest.config.ts`, the corresponding `*.test.tsx` / `*.test.ts` files. |

## 3. Validation and delivery changes

The same period introduced fresh-database CI validation (`af8bab5`, followed by PRs #95 and #98). It builds `database/schema.sql`, loads `database/seed.sql`, and checks required objects with `database/verify_schema.sql`. PR #116 then supplied a disposable local PostgreSQL database to backend coverage tests so the submission integration suite can run in CI, and strengthened frontend coverage execution.

PR #99 (`fef1f81`) added Railway backend deployment after the frontend, backend, database, and documentation jobs. The deployment job runs only on pushes to `main` and requires Railway repository secrets. These are configured checks and deployment behaviour; this page does not claim that a particular CI run passed or that a production deployment completed. See [Testing](../testing.md) for the current validation scope.

## 4. Evidence limits and follow-up

- No completed Sprint 3 retrospective, meeting minutes, user-test survey, or recorded stakeholder acceptance outcome is committed.
- Git merge records identify Pull Requests; they do not by themselves establish the content of peer review or Taiga task completion.
- The team must supply reflections, meeting decisions, feedback, and exact sprint boundaries before those can be added as evidence.

