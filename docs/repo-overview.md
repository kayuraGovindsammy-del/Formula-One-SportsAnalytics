# Repo Overview — F1 Sport Analytics

Handoff document for an AI assistant with no access to this codebase. Written from reading
the actual source at commit `37d20b5` (branch `main`, working tree clean).

The project is a Formula 1 analytics platform: an event-sourced data model where race
statistics are *derived* from a lap/event log rather than stored as totals.

---

## 1. Stack

| Layer | Choice | Version (from package.json) |
|---|---|---|
| Runtime | Node.js | `engines: >=22` (root); CI runs Node **20** — mismatch, see Gaps |
| Package manager | npm | lockfiles: `src/backend/package-lock.json`, `src/frontend/package-lock.json` |
| Backend framework | Express | `^5.2.1` |
| Backend language | TypeScript | `^7.0.2`, ESM (`"type": "module"`, `module: NodeNext`), `strict` + `noUncheckedIndexedAccess` |
| Validation | Zod | `^4.4.3` |
| DB driver | `pg` (raw SQL, `pg.Pool`) | `^8.23.0` |
| ORM / query builder | **none** — hand-written SQL string literals | — |
| Auth (server) | `firebase-admin` (ID-token verify + Firestore profile read) | `^14.3.0` |
| CORS / config | `cors` `^2.8.6`, `dotenv` `^17.4.2` | |
| Backend test runner | Vitest + Supertest | `vitest ^4.1.11`, `supertest ^7.2.2` |
| Dev runner | `tsx` | `^4.23.12` |
| Frontend | React + React Router | `react ^19.2.8`, `react-router-dom ^7.18.2` |
| Frontend build | Vite | `^8.2.0` (TS `~6.0.2`) |
| Frontend auth SDK | `firebase` | `^12.17.1` |
| Frontend lint | ESLint | `^10.8.0` + `typescript-eslint ^8.65.0` |
| Frontend tests | **none** | — |
| Database | PostgreSQL (Neon, per README) | schema in `database/schema.sql` |
| Docs site | MkDocs (`requirements-docs.txt`, `mkdocs.yml`) | |

Root `package.json` only delegates: `build` and `start` proxy into `src/backend`. There is no
root test script and no workspaces config — the two apps are installed independently.

---

## 2. Tree (3 levels, excl. node_modules/dist/.git/lockfiles)

```
.
├── .env.example                  # frontend Firebase vars (misplaced at root)
├── .gitea/workflows/ci.yml       # the ONLY active pipeline
├── workflows/deploy-azure.yml    # NOT in a CI-recognised directory — inert
├── README.md, mkdocs.yml, firebase.json, firestore.rules
├── setup.ps1, start.ps1          # Windows-only dev scripts
├── requirements-docs.txt
├── data/sample/
│   ├── drivers.json   (20 drivers, 2025 grid)
│   ├── races.json     (24 races, season 2025)
│   ├── laps.json      (13 laps — a subset of one session)
│   └── events.json    (10 events, 1 session + a session_result block)
├── database/
│   ├── schema.sql                # full Postgres DDL
│   ├── seed.sql                  # 164 lines, generated from data/sample
│   └── migrations/001_api_migration.sql
├── docs/
│   ├── api-design.md, data-model.md, database-design.md, event-schema.md
│   ├── f1-statistics.md, methodology.md, git-workflow.md
│   ├── auth-and-submission-workflow.md, index.md
│   └── wireframes/*.png
├── tests/                        # empty (.gitkeep only)
└── src/
    ├── backend/
    │   ├── package.json, tsconfig.json, vitest.config.ts, .env.example
    │   └── src/
    │       ├── index.ts, app.ts
    │       ├── config/       database.ts, firebaseAdmin.ts
    │       ├── controllers/  health, drivers, races, submissions (+1 test)
    │       ├── middleware/   authenticate, authorization, errorHandler,
    │       │                 notFoundHandler, ApiError, asyncHandler (+1 test)
    │       ├── models/       drivers, races, laps, events, sessions,
    │       │                 constructors, raceResults, submissions, sampleData
    │       ├── routes/       index, health, drivers, races, submissions (+3 tests)
    │       ├── services/     lapStatistics, pitStatistics, raceStatistics,
    │       │                 driverStatistics, runningOrder (+5 tests)
    │       ├── types/        api, auth, driver, event, lap, race, session,
    │       │                 submission, user
    │       └── utils/        pagination.ts, queryValidation.ts
    └── frontend/
        ├── package.json, vite.config.ts, eslint.config.js, index.html
        ├── public/  favicon.svg, icons.svg
        └── src/
            ├── App.tsx, main.tsx, index.css, App.css
            ├── auth/        AuthContext, useAuth, firebase, ProtectedRoute,
            │                AdminRoute, SubmitterRoute
            ├── components/  DriverCard, RaceCard, StatCard, layout/
            ├── data/        f1Data.ts (API client), constructors.ts (hardcoded map)
            └── pages/       Dashboard, Drivers, DriverDetails, Races,
                             RaceDetails, Constructors, Statistics,
                             Auth/{Login,Account}, Submit/SubmitData,
                             Admin/{SubmissionReview,SubmitterRequests}
```

---

## 3. API surface

All routes are mounted under `/api/v1` (`app.ts` → `routes/index.ts`). Success envelope is
`{ data, meta }`; errors are `{ error: { code, message } }` — **except** the auth middleware,
which returns `{ error: "<string>" }` (inconsistent, see Gaps).

| Method | Path | Data source | Test |
|---|---|---|---|
| GET | `/api/v1/health` | none (static `{status:"ok"}`) | ✅ `controllers/health.controller.test.ts` |
| GET | `/api/v1/drivers` | **Mock** — `data/sample/drivers.json` | ✅ `routes/drivers.routes.test.ts` |
| GET | `/api/v1/drivers/:driver_id` | **Mock** — same | ✅ same |
| GET | `/api/v1/drivers/:driver_id/stats?season=` | **Mock** — derived from sample laps/events | ✅ `routes/statistics.routes.test.ts` |
| GET | `/api/v1/races` | **Mock** — `data/sample/races.json` | ✅ `routes/races.routes.test.ts` |
| GET | `/api/v1/races/:grand_prix_id` | **Mock** — same | ✅ same |
| GET | `/api/v1/races/:grand_prix_id/laps` | **Mock** — `data/sample/laps.json` | ✅ same |
| GET | `/api/v1/races/:grand_prix_id/events` | **Mock** — `data/sample/events.json` | ✅ same |
| GET | `/api/v1/races/:grand_prix_id/statistics` | **Mock** — partly derived, partly the canned `session_result` block | ✅ `routes/statistics.routes.test.ts` |
| GET | `/api/v1/submissions` | **Real Postgres** + Firebase auth | ❌ none |
| POST | `/api/v1/submissions` | **Real Postgres** + Firebase auth | ❌ none |
| GET | `/api/v1/submissions/:submission_id` | **Real Postgres** + Firebase auth | ❌ none |
| PATCH | `/api/v1/submissions/:submission_id` | **Real Postgres** + Firebase auth (admin only) | ❌ none |

Notes:

- Every read endpoint is served entirely from JSON files on disk. `getPool()` is imported by
  exactly one file: `models/submissions.model.ts`. Nothing else touches Postgres.
- Query params: `page`, `per_page` (default 20; 100 for laps/events; clamped at 100),
  plus `constructor_id`/`nationality`/`search` (drivers), `season`/`has_sprint`/`search`
  (races), `driver_id`/`session_type`/`type` (laps/events). Unknown params are silently
  ignored (Zod strips them).
- `/submissions` is guarded by `authenticate` (verifies a Firebase ID token, then reads the
  user's Firestore `users/{uid}` doc for role) then `requireSubmitterOrAdmin` /
  `requireAdmin`. Role lives in **Firestore**, not Postgres — Postgres `users` rows are
  upserted opportunistically on each write (`ensureDatabaseUser`).
- There is no `routes/statistics.routes.ts`. The file `routes/statistics.routes.test.ts`
  tests the stats endpoints that live on the drivers/races routers.

---

## 4. Data layer

Schema: `database/schema.sql` (single file, applied manually — **no migration runner**).
Migrations: `database/migrations/001_api_migration.sql` (one file, hand-run, additive
`ADD COLUMN IF NOT EXISTS` for `submissions.event_data`, `race_results.pit_stops`,
`race_results.gap_to_winner_ms`). Seed: `database/seed.sql`, idempotent, generated from
`data/sample/*.json`; deliberately does **not** seed users.

Enums: `user_role` (USER/SUBMITTER/ADMIN), `submitter_status` (NONE/PENDING/APPROVED/REJECTED),
`session_type` (PRACTICE_1..3, QUALIFYING, SPRINT_QUALIFYING, SPRINT, RACE),
`submission_status` (PENDING/ACCEPTED/REJECTED), `penalty_type` (TIME/GRID_DROP/DISQUALIFICATION),
`result_status` (FINISHED/DNF/DSQ).

Tables and key columns:

| Table | PK | Notable columns | FKs |
|---|---|---|---|
| `users` | `user_id` BIGSERIAL | `auth_uid` UNIQUE, `email` UNIQUE, `role`, `submitter_status` | — |
| `seasons` | `season_id` VARCHAR | `year` UNIQUE, CHECK ≥1950 | — |
| `circuits` | `circuit_id` | `circuit_name`, `locality`, `country` | — |
| `grand_prix` | `grand_prix_id` | `round`, `race_name`, `race_date`, `has_sprint`, UNIQUE(season,round) | → seasons, circuits |
| `sessions` | `session_id` | `type`, `total_laps`, `start_time`, `end_time`, UNIQUE(gp,type) | → grand_prix |
| `drivers` | `driver_id` | `permanent_number`, names, `nationality`, `date_of_birth` | — |
| `constructors` | `constructor_id` | `name`, `nationality` | — |
| `driver_constructor_links` | (season, driver, constructor) | join table — a driver's team is **per season** | → all three |
| `submissions` | `submission_id` | `status`, `event_data` JSONB, `validation_message`, `submitted_at`, `reviewed_at`, `reviewed_by` | → users, sessions, users |
| `laps` | (session, driver, lap_number) | `lap_time_ms`, `position`, `is_pit_lap`, `is_valid`, `submission_id` | → sessions, drivers, submissions |
| `pit_stops` | `pit_stop_id` | `lap_number`, `duration_ms` | → sessions, drivers, submissions |
| `position_changes` | `position_change_id` | `overtaken_driver_id`, `position_before/after` | → sessions, drivers ×2, submissions |
| `penalties` | `penalty_id` | `penalty_type`, `duration_ms`, `reason` | → sessions, drivers, submissions |
| `retirements` | `retirement_id` | `reason`, UNIQUE(session,driver) | → sessions, drivers, submissions |
| `race_results` | (session, driver) | `position`, `points`, `laps_completed`, `pit_stops`, `gap_to_winner_ms`, `status` — **derived table**, not source data | → sessions, drivers, constructors |

Indexes: `sessions(grand_prix_id)`, `laps(driver_id)`, `laps(session_id)`,
`submissions(submitter_user_id)`, `submissions(status)`.

**Structural note:** there is no `events` table. The event log is decomposed across `laps`,
`pit_stops`, `position_changes`, `penalties`, `retirements`. Any future Postgres-backed
`events.model.ts` has to reassemble the event envelope (UNION ALL or a view) — the current
file-backed model returns a shape the schema cannot produce with a single SELECT.

Identity is split: Firebase Auth + Firestore hold the user profile and role; Postgres
`users` is a mirror populated on demand.

---

## 5. Statistics

All derivation lives in `src/backend/src/services/` as **pure functions** — no Express, no
I/O. Data is passed in by the controller.

**Implemented and reachable via an endpoint:**

| Statistic | Function | File | Wired into |
|---|---|---|---|
| Fastest lap | `fastestLap()` | `lapStatistics.ts:74` | race stats, driver stats |
| Average race pace | `averageLapTime()` | `lapStatistics.ts:56` | driver stats |
| Racing-lap filter (excludes pit/invalid/untimed) | `isRacingLap()` | `lapStatistics.ts:35` | both |
| Pit stop count | `pitStopCount()` | `pitStatistics.ts:27` | race stats |
| Race classification (position, laps, pit stops, gap) | `buildRaceStatistics()` | `raceStatistics.ts:104` | `/races/:id/statistics` |
| Overtake count (`POSITION_CHANGE` count) | inline in `buildRaceStatistics` | `raceStatistics.ts:195` | same |
| Retirement / DNF count | inline | `raceStatistics.ts:188` | same |
| Gap to winner | inline (cumulative lap time) | `raceStatistics.ts:155-175` | same |
| Races entered, wins, podiums, DNF count, DNF rate, fastest laps, average finish position | `buildDriverStatistics()` | `driverStatistics.ts:63` | `/drivers/:id/stats` |

**Implemented and fully unit-tested, but NOT reachable from any endpoint (dead code today):**

| Statistic | Function | File |
|---|---|---|
| Lap consistency (population stddev) | `lapConsistency()` | `lapStatistics.ts:111` |
| Total pit time | `totalPitTime()` | `pitStatistics.ts:38` |
| Running order at lap N (POSITION_CHANGE replay) | `runningOrderAtLap()` | `runningOrder.ts:152` |

**Hard-coded `null` — stubs:**

- `points` (`driverStatistics.ts:151`) — no points-scoring rule exists anywhere in schema or
  docs. `race_results.points` is an unused column.
- `positions_gained_lost_avg` (`driverStatistics.ts:152`) — needs a starting grid from a
  QUALIFYING classification; no qualifying data exists.
- Constructor points / standings — not implemented anywhere on the backend.
- Qualifying-vs-race performance (`docs/f1-statistics.md` §3) — not implemented.

**Known correctness limitations documented in the code:**

- No safety-car flag on `LAP_COMPLETED`, so `average_race_pace_ms` and consistency include
  safety-car laps and are inflated.
- `runningOrderAtLap` infers its baseline grid from the race log itself because no qualifying
  data exists; it accepts an optional `startingOrder` for when that lands.
- `gap_to_winner_ms` returns `null` unless *every* classified driver has a complete lap log.
  With the 13-lap sample, that never happens — which is why the controller substitutes canned
  data (below).

**The important caveat on `/races/:id/statistics`:** `races.controller.ts:150-180` computes
the derived statistics, then **overwrites** `fastest_lap` and `classification` with the
stored `session_result` block read from `data/sample/events.json` via `raceResults.model.ts`.
The flagship "everything is derived" endpoint currently serves a hand-entered result table
for the one race that has data. The derivation runs but its classification output is
discarded.

---

## 6. External integrations

Outbound HTTP from application code:

| Direction | Service | Where |
|---|---|---|
| Frontend → backend | own API, `fetch()` | `src/frontend/src/data/f1Data.ts:239` (`apiGet`), plus 4 authed calls in `pages/Submit/SubmitData.tsx:435` and `pages/Admin/SubmissionReview.tsx:53,126,197` |
| Frontend → Firebase | Firebase Auth + Firestore SDK | `src/frontend/src/auth/firebase.ts`, `AuthContext.tsx`, `pages/Auth/Account.tsx`, `pages/Admin/SubmitterRequests.tsx` |
| Backend → Firebase | `firebase-admin` — `verifyIdToken`, Firestore `users/{uid}` read | `src/backend/src/config/firebaseAdmin.ts`, used by `middleware/authenticate.ts` |
| Backend → Postgres | `pg` pool over `DATABASE_URL` | `src/backend/src/config/database.ts` |

The backend makes **no** outbound HTTP calls to third-party sports data APIs. The Jolpica-F1
and OpenF1 APIs are cited in `data/sample/*.json` `_source` fields and in the docs as where
the sample data was manually sourced from — there is no client for either.

Env var **names** (values never committed; all example files hold empty or clearly-fake
placeholders):

- Backend: `PORT`, `CORS_ORIGINS`, `DATABASE_URL`, `FIREBASE_PROJECT_ID`,
  `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- Frontend: `VITE_API_BASE_URL`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
  `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`
- CI: `AZURE_WEBAPP_PUBLISH_PROFILE` (referenced as a secret in the inert deploy workflow)

---

## 7. Tests

Backend only. Run with `npm test` (→ `vitest run`) from `src/backend`.
Verified: **10 files, 125 tests, all passing** (409 ms).

| File | Tests | What it covers |
|---|---|---|
| `services/lapStatistics.test.ts` | 325 lines | fastest lap, average, consistency, edge cases |
| `services/raceStatistics.test.ts` | 251 lines | classification, gaps, overtakes, DNFs |
| `services/driverStatistics.test.ts` | 249 lines | season aggregation |
| `services/runningOrder.test.ts` | 175 lines | POSITION_CHANGE replay + baseline inference |
| `services/pitStatistics.test.ts` | 112 lines | counts + durations |
| `routes/races.routes.test.ts` | 283 lines | HTTP-level via Supertest |
| `routes/statistics.routes.test.ts` | 238 lines | both stats endpoints, incl. real-race assertions |
| `routes/drivers.routes.test.ts` | 159 lines | HTTP-level via Supertest |
| `middleware/errorHandler.test.ts` | 40 lines | error envelope |
| `controllers/health.controller.test.ts` | 24 lines | health |

Rough coverage: the pure derivation services are thoroughly covered, and every file-backed
read endpoint has HTTP-level tests. **Zero coverage** for: all four `/submissions` endpoints,
`middleware/authenticate.ts`, `middleware/authorization.ts`, `models/submissions.model.ts`,
`config/database.ts`, `config/firebaseAdmin.ts`, and the entire frontend. No coverage
reporting is configured. No integration test touches Postgres. The root `tests/` directory is
empty.

---

## 8. CI

Active pipeline: `.gitea/workflows/ci.yml` (Gitea Actions), on push and PR to `main`.
Three parallel jobs, all `ubuntu-latest`:

1. **frontend** — Node 20, `npm ci`, `npm run lint`, `npm run build` (in `src/frontend`)
2. **backend** — Node 20, `npm ci`, `npm run build` (tsc), `npm test` (vitest) (in `src/backend`)
3. **docs** — Python 3.12, `pip install -r requirements-docs.txt`, `mkdocs build --strict`

Not run by CI: any deployment, database migration, security scan, coverage reporting, or
formatting check.

`workflows/deploy-azure.yml` (frontend build → `azure/webapps-deploy@v3`, app
`f1-sport-analytics`) sits at the repo root, **not** in `.gitea/workflows/` or
`.github/workflows/` — no runner picks it up. It is documentation, not a pipeline.

---

## 9. Gaps — blunt list

1. **Every read endpoint is mock data.** Eight of twelve routes read JSON files off disk at
   process boot. Postgres is used by exactly one model (`submissions`). The `pg` dependency,
   the schema, and the seed exist; the read path does not use any of them.
2. **The race statistics endpoint fakes its headline output.** It derives statistics, then
   throws away the derived `classification` and `fastest_lap` and substitutes a hand-entered
   `session_result` block from `data/sample/events.json`. The 10 classification rows the API
   returns for the Belgian GP were typed in by a person, not computed. The route test asserts
   against those typed-in values, so the test passes without the derivation being correct.
3. **Sample data is 13 laps of a 44-lap race, for one session of one race, in one season.**
   `has_results` is true for exactly one of 24 races. Everything else returns empty
   derivations or 404s.
4. **Three tested statistics functions are unreachable.** `lapConsistency`, `totalPitTime`,
   `runningOrderAtLap` have no caller outside their tests. `runningOrder.ts` is described in
   its own header as the clearest demonstration of the event-sourced design and is exposed
   nowhere.
5. **`points` and `positions_gained_lost_avg` are hard-coded `null`.** No points rule is
   defined anywhere; no qualifying data exists. Constructor standings don't exist at all on
   the backend — `pages/Constructors/Constructors.tsx` builds the team list client-side from
   a hardcoded name map (`data/constructors.ts`) intersected with the drivers list.
6. **Constructor names are hardcoded in two places.** `models/constructors.model.ts` and
   `frontend/src/data/constructors.ts` hold duplicate copies of the same 10-entry map, while
   a `constructors` table sits populated in `seed.sql`.
7. **Zero tests on the only real-database code path.** All four `/submissions` endpoints, both
   auth middlewares, and the submissions model are untested. That is also the only code that
   can lose data.
8. **Two error-envelope shapes.** Routes return `{error:{code,message}}`; `authenticate` and
   `authorization` return `{error:"string"}`. Frontend callers defensively handle both
   (`f1Data.ts:243-250`) — a symptom, not a fix.
9. **Identity is split across two stores with no reconciliation.** Role and submitter status
   are authoritative in Firestore; Postgres `users` is upserted from the token on every
   submission write. A role changed in Firestore silently diverges from Postgres, and nothing
   reads the Postgres `role` column.
10. **Deployment is not wired.** `workflows/deploy-azure.yml` is in a directory no CI reads.
    The frontend's default API base URL is a **Railway** host
    (`f1Data.ts:1-3`), the backend's `CORS_ORIGINS` example names an **Azure** host, and the
    README states there is no evidence for a Railway deployment. Three different answers.
11. **No migration tooling.** One hand-written migration file, applied manually. `schema.sql`
    and `001_api_migration.sql` have already drifted into overlap (the migration adds columns
    the schema now also declares). No ordering, no state tracking, no rollback.
12. **Node version mismatch.** Root `package.json` requires `>=22`; CI runs Node 20 for both
    apps; the inert deploy workflow uses 22.
13. **Stale documentation in the code.** `src/backend/README.md:48` says `DATABASE_URL` is
    "not wired up yet — placeholder", which stopped being true when submissions landed.
14. **No frontend tests, no coverage reporting, no formatter, no security scanning.** The
    frontend's 3,800 lines of pages — including a 1,099-line `SubmitData.tsx` — are covered
    only by `tsc` and ESLint.
15. **`.env.example` at repo root holds frontend `VITE_*` vars** while `src/frontend/.env.example`
    holds only `VITE_API_BASE_URL`. The Firebase client vars are in the wrong directory to be
    picked up by Vite.
16. **`tests/` at the repo root is empty** (`.gitkeep`), implying a test location nobody uses.
17. **`setup.ps1` / `start.ps1` are PowerShell-only.** No shell equivalent for the macOS/Linux
    contributors, and CI doesn't use them either.

---

## 10. Branch state

`git fetch --all --prune` then `git branch -r --no-merged main` returns **nothing**. All 24
remote branches are fully merged into `main`; the working tree is clean and `main` is level
with `origin/main` at `37d20b5`.

**This overview is therefore complete — no team member's work is sitting unmerged.**

Merged branch history (all reachable from `main`): `feature/f1-docs`, `feature/api-design`,
`feature/backend-setup`, `feature/api-read-endpoints`, `feature/derivation-engine`,
`feature/frontend-setup`, `feature/frontend-real-data`, `feature/dashboard-sample-data`,
`feature/f1-sample-data`, `feature/database-auth`, `feature/hosted-api-neon-integration`,
`feature/constructors-statistics`, `feature/ci-pipeline`, `feature/Documentation-CI-Correction`,
`feature/documentation-finalisation`, `feature/readme-dev-setup`, `core/azure-deployment`,
`docs/add-wireframes`, `fix/api-data-pages`, `fix/full-race-results`, `fix/multiple-cors-origins`,
`fix/race-results-and-cors`.

The remote is a self-hosted Gitea at `sdp.ms.wits.ac.za/eaglestack/SportsAnalytics` — merges
land as Gitea pull requests (most recent: PR #45). Old branches are not deleted after merge,
so the branch list overstates activity; the merge state is what matters, and it is clean.
