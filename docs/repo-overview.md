# Repo Overview — F1 Sport Analytics

This document summarizes the project's architecture, data model, integrations,
testing, and deployment. Test measurements are recorded in
[Testing Overview](testing.md).

The project is a Formula 1 analytics platform: an event-sourced data model where race
statistics are *derived* from a lap/event log rather than stored as totals. Ingested
Jolpica classifications, grids, fastest laps and published points provide explicit
fallbacks or published-fact inputs when the log is unavailable.

---

## 1. Tech Stack

| Layer | Choice | Version (from package.json) |
|---|---|---|
| Runtime | Node.js | `engines: >=22` (root); CI runs Node **22**; local frontend tools need **22.13+** within 22.x |
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
| Frontend charts | Recharts | `^3.10.1` |
| Frontend tests | Vitest + Testing Library/jsdom; Playwright; Firestore rules tests | `vitest ^5.0.2`, `@playwright/test ^1.63.0`, `@firebase/rules-unit-testing ^5.0.0` |
| Interactive API docs | Swagger UI + YAML | `swagger-ui-express ^5.0.1`, `yaml ^2.9.1` |
| Database | PostgreSQL (Aiven CA configured in the current database pool) | schema in `database/schema.sql` |
| Docs site | MkDocs (`requirements-docs.txt`, `mkdocs.yml`) | |

Root `package.json` delegates `build`, `start` and `ingest` into `src/backend`. There is no
root test script and no workspaces config — the two apps are installed independently.

---

## 2. Tree (key source locations, excl. node_modules/dist/.git/lockfiles)

```text
.
├── .env.example                  # VITE_FIREBASE_* examples; client uses constants
├── .gitea/workflows/ci.yml        # validation and gated Railway deployment
├── workflows/deploy-azure.yml    # legacy, outside a CI-recognised directory
├── README.md, mkdocs.yml, firebase.json, firestore.rules
├── setup.ps1, start.ps1           # Windows development helpers
├── requirements-docs.txt
├── data/sample/                  # development seed and test fixtures
├── database/
│   ├── schema.sql, seed.sql, verify_schema.sql
│   └── migrations/001_*.sql ... 007_*.sql
├── docs/
│   ├── api/openapi.yaml, wireframes/*.png
│   ├── ingestion/, retrospectives/, user-testing/, meetings/
│   └── project, setup, workflow and architecture Markdown pages
└── src/
    ├── backend/
    │   ├── package.json, tsconfig.json, vitest.config.ts, .env.example
    │   ├── tools/copy-openapi-spec.mjs
    │   └── src/
    │       ├── index.ts, app.ts
    │       ├── config/            database, firebaseAdmin, openapiSpec
    │       ├── controllers/      drivers, races, constructors, submissions, chat, exports
    │       ├── middleware/       authentication, authorization, errors, rate limits
    │       ├── models/           PostgreSQL read/write models and test fixtures
    │       ├── routes/           HTTP endpoints and Supertest tests
    │       ├── services/         statistics, points, submission validation, account deletion
    │       ├── chat/             LLM client, assistant, read-only tools, reply formatting
    │       ├── ingestion/        Jolpica, OpenF1, mapping, rate limiting and disk cache
    │       ├── scripts/          ingest, ingestOvertakes, cleanupAccounts
    │       └── types/, utils/, test/
    └── frontend/
        ├── package.json, vite.config.ts, vitest.config.ts, playwright.config.ts
        ├── public/               driver images and circuit layouts
        ├── tests/                Firestore emulator rules tests
        ├── e2e/                  unauthenticated login/navigation smoke tests
        └── src/
            ├── App.tsx, main.tsx, index.css, App.css
            ├── auth/             Firebase profile state, guards, submitter transactions
            ├── api/              submissions, exports and chat clients
            ├── components/       cards, layout, timeline, downloads, chat widget
            ├── data/             f1Data API mapping, images and team styles
            └── pages/            Dashboard, Drivers, DriverDetails, Races,
                                  RaceDetails, QualifyingDetails, PredictionsDetails,
                                  Constructors, Statistics, Auth/{Login,Account},
                                  Submit/{SubmitData,MySubmissions},
                                  Admin/{SubmissionReview,SubmitterRequests}
```

---

## 3. API surface

Application routes are mounted under `/api/v1` (`app.ts` → `routes/index.ts`).
Success responses use `{ data, meta }`; failures, including authentication and
role failures, use `{ error: { code, message } }`. Exports return file attachments
and completed account deletion returns HTTP 204.

| Method | Path (under `/api/v1`) | Data / access | Test evidence |
|---|---|---|---|
| GET | `/health` | Static process health, no database readiness check | `health.routes.test.ts` |
| GET | `/drivers`, `/drivers/:driver_id` | PostgreSQL, public | `drivers.routes.test.ts` |
| GET | `/drivers/:driver_id/stats?season=` | SQL inputs plus pure derivation, public | `statistics.routes.test.ts`, `driverStats.*.test.ts` |
| GET | `/constructors/:constructor_id/stats?season=` | Published SQL points summed per race/team, public | `constructors.routes.test.ts` |
| GET | `/races`, `/races/:grand_prix_id` | PostgreSQL, public | `races.routes.test.ts` |
| GET | `/races/:grand_prix_id/laps`, `/races/:grand_prix_id/events` | PostgreSQL, public | `races.routes.test.ts` |
| GET | `/races/:grand_prix_id/statistics` | Lap/event derivation; SQL classification/fastest-lap fallback, public | `statistics.routes.test.ts` |
| GET | `/races/:grand_prix_id/qualifying` | SQL Q1/Q2/Q3 classification, public | `qualifying.routes.test.ts` |
| GET | `/export/:dataset?format=&season=` | SQL CSV/JSON attachment, public; races/drivers/constructors/results/laps | `exports.routes.test.ts` |
| POST | `/chat` | Public, rate-limited; Groq/Gemini plus whitelisted read-only tools | `chat.routes.test.ts`, `chat/*.test.ts` |
| GET | `/submissions` | SQL; approved submitter's own records or administrator's queue | `submissions.routes.test.ts` |
| GET | `/submissions/mine` | SQL; authenticated caller's own records, including administrators | `submissions.routes.test.ts` |
| GET | `/submissions/:submission_id` | SQL; authenticated owner or administrator | `submissions.routes.test.ts` |
| POST | `/submissions` | SQL validated event; approved submitter or administrator | `submissions.routes.test.ts`, `submissions.model.test.ts` |
| PATCH | `/submissions/:submission_id` | Administrator; terminal review and transactional publication | same, plus `submissions.integration.test.ts` |
| DELETE | `/users/me` | Authenticated, recently reauthenticated user; 204 complete or 202 pending cleanup | `users.routes.test.ts`, `accountDeletion.test.ts` |

Interactive documentation is mounted separately at `/api/docs`, with the
hand-written specification at `/api/openapi.yaml` and `/api/openapi.json`.
`docs/api/openapi.yaml` describes routes; it does not generate application code.

Notes:

- Mounted F1 read models use PostgreSQL. Sample JSON supports seed generation and
  tests; it is not a runtime fallback for failed database access.
- Pagination uses `page` and `per_page` (default 20; 100 for logs, clamped at 100).
  Driver filters include constructor, nationality and search; race filters include
  season, sprint-weekend flag and search. Logs default to `RACE` and support
  session type, driver and event-type filters. See [API Design](api-design.md).
- Firebase token verification checks revocation. Firestore `users/{uid}` is the
  role source, and missing/deleting profiles fail closed. PostgreSQL `users` is
  synchronized on submission/review writes rather than used for authorization.
- Standings and disqualification helpers are available to chat tools, not as
  standalone standings/disqualification HTTP routes.

---

## 4. Data layer

Schema: `database/schema.sql` for a fresh database, applied manually — **no migration
runner**. Existing databases use the ordered `001`–`007` migrations for API fields,
account deletion, submissions/accepted events, published grids/fastest laps, event-log
indexes and qualifying results. Seed: `database/seed.sql`, idempotent, generated from
`data/sample/*.json`; deliberately does **not** seed users. `verify_schema.sql` checks
required schema objects in CI. See [Database Design](database-design.md).

Enums: `user_role` (USER/SUBMITTER/ADMIN), `submitter_status` (NONE/PENDING/APPROVED/REJECTED),
`session_type` (PRACTICE_1..3, QUALIFYING, SPRINT_QUALIFYING, SPRINT, RACE),
`submission_status` (PENDING/ACCEPTED/REJECTED), `penalty_type` (TIME/GRID_DROP/DISQUALIFICATION),
`result_status` (FINISHED/DNF/DSQ).

Tables and key columns:

| Table | PK | Notable columns | FKs |
|---|---|---|---|
| `users` | `user_id` BIGSERIAL | `auth_uid` UNIQUE, `email` UNIQUE, `role`, `submitter_status` | — |
| `account_deletions` | `auth_uid` | `requested_at`, `completed_at`, `attempts`, `last_attempt_at` | — |
| `seasons` | `season_id` VARCHAR | `year` UNIQUE, CHECK ≥1950 | — |
| `circuits` | `circuit_id` | `circuit_name`, `locality`, `country` | — |
| `grand_prix` | `grand_prix_id` | `round`, `race_name`, `race_date`, `has_sprint`, UNIQUE(season,round) | → seasons, circuits |
| `sessions` | `session_id` | `type`, `total_laps`, `start_time`, `end_time`, UNIQUE(gp,type) | → grand_prix |
| `drivers` | `driver_id` | `permanent_number`, names, `nationality`, `date_of_birth` | — |
| `constructors` | `constructor_id` | `name`, `nationality` | — |
| `driver_constructor_links` | (season, driver, constructor) | join table — a driver's team is **per season** | → all three |
| `submissions` | `submission_id` | `status`, `event_data` JSONB, `validation_message`, `submitted_at`, `reviewed_at`, `reviewed_by` | → users, sessions, users |
| `accepted_events` | `event_id` | exact validated `event_data` JSONB, UNIQUE `submission_id`, `accepted_at` | → submissions, sessions |
| `qualifying_results` | (session, driver) | `position`, `q1_time_ms`, `q2_time_ms`, `q3_time_ms` | → sessions, drivers, constructors |
| `laps` | (session, driver, lap_number) | `lap_time_ms`, `position`, `is_pit_lap`, `is_valid`, `submission_id` | → sessions, drivers, submissions |
| `pit_stops` | `pit_stop_id` | `lap_number`, `duration_ms` | → sessions, drivers, submissions |
| `position_changes` | `position_change_id` | `overtaken_driver_id`, `position_before/after` | → sessions, drivers ×2, submissions |
| `penalties` | `penalty_id` | `penalty_type`, `duration_ms`, `reason` | → sessions, drivers, submissions |
| `retirements` | `retirement_id` | `reason`, UNIQUE(session,driver) | → sessions, drivers, submissions |
| `race_results` | (session, driver) | published position, points, laps, pit stops, gap, status, grid and fastest-lap rank/number/time | → sessions, drivers, constructors |

Indexes cover session/lap lookups, qualifying results, normalized event tables,
accepted-event logs, submission event IDs/owner history/review queues and pending
account deletion. Their definitions are in `database/schema.sql`.

**Structural note:** there is no generic `events` table. `accepted_events` preserves
the validated event envelope; accepted submissions also populate `laps`, `pit_stops`,
`position_changes`, `penalties` or `retirements` atomically. Session boundaries
and fastest-lap markers remain envelope-only. The SQL
events model reassembles accepted envelopes and legacy normalized rows with
`submission_id IS NULL`, avoiding duplicates. Submission data is stored in PostgreSQL,
not in a Firestore submissions collection.

Identity is split: Firebase Auth + Firestore hold the user profile and role; Postgres
`users` is a mirror populated on demand.

---

## 5. Statistics

The statistic builders in `src/backend/src/services/` are pure functions. The
controllers load SQL inputs before calling them; they do not persist aggregate
statistics. Driver-season reads batch sessions, laps, events and classifications
rather than querying once per race.

| Statistic | Function / source | Wired into |
|---|---|---|
| Fastest lap | `fastestLap()`; stored published fastest lap as fallback | Race and driver statistics |
| Average race pace | `averageLapTime()` after `isRacingLap()` | Driver statistics |
| Lap consistency | `lapConsistency()` (population standard deviation) | Race classification rows |
| Pit stop count | `pitStopCount()` | Race statistics |
| Classification, gaps, position changes and retirements | `buildRaceStatistics()` | `/races/:id/statistics` |
| Races entered, wins, podiums, DNF count/rate, fastest laps, average finish | `buildDriverStatistics()` | `/drivers/:id/stats` |
| Points | Stored per-race published points; `pointsForPosition()` fallback | Driver statistics |
| Positions gained/lost | Qualifying-event or published-grid start minus finish | Driver statistics |
| Constructor points | `buildConstructorStatistics()` over each result's constructor | `/constructors/:id/stats` |
| Driver/constructor rankings and separate DSQ counts | Season loaders and `rankDrivers()` | Chat tools |

`totalPitTime()` and `runningOrderAtLap()` remain unit-tested helpers with no
mounted HTTP caller. The displayed race timeline groups and filters recorded
highlights; it does not expose the running-order replay helper.

Data availability rules matter:

- Race classification uses lap-derived rows whenever any are available; stored
  `race_results` is used only when the derived classification is empty. A partial
  lap log can therefore yield an incomplete classification rather than the full
  published result. Fastest lap independently prefers the lap-derived value.
- Stored positions support driver statistics when no lap-derived finishing
  position exists. Stored fastest-lap rank is used only when the entire session
  has no laps. Stored points are preferred whenever a published row exists.
- Driver and constructor statistics count `RACE` sessions only. Sprint results
  can be ingested and exported, but their points are not included in these totals.
- Pit/invalid/untimed laps are excluded from average pace and consistency. The
  event schema has no safety-car flag; available safety-car laps remain included.
- Lap-derived gaps need complete timed logs for all classified drivers. Missing
  information yields `null`; published fallback rows may contain supplied gaps.
- Retirement events determine DNF counts; published disqualifications are counted
  separately by chat helpers. Counts reflect the event data that was loaded.

Frontend predictions are a deterministic estimate in `PredictionsDetails.tsx`:
60% qualifying position plus 40% season average finish (qualifying-position
fallback), with estimated pace used for score ties. Pace uses the best available
qualifying lap multiplied by 1.07, blended 60/40 with season average race pace
when available. Drivers without a positive qualifying time are omitted. Season
statistics have no pre-race cutoff, so these estimates can include the selected
race and later results; there is no documented accuracy study or trained model.

See [F1 Statistics](f1-statistics.md) for the definitions and limits.

---

## 6. External integrations

Outbound HTTP from application code:

| Direction | Service | Where |
|---|---|---|
| Frontend → backend | own API, `fetch()` | `src/frontend/src/data/f1Data.ts`, `src/api/{submissions,chat,exports}.ts`, `AuthContext.tsx` |
| Frontend → Firebase | Firebase Auth + Firestore SDK | `src/frontend/src/auth/firebase.ts`, `AuthContext.tsx`, `pages/Auth/Account.tsx`, `pages/Admin/SubmitterRequests.tsx` |
| Backend → Firebase | `firebase-admin` — `verifyIdToken` with revocation check; profile and deletion markers | `src/backend/src/config/firebaseAdmin.ts`, used by `middleware/authenticate.ts` |
| Backend → Postgres | `pg` pool over `DATABASE_URL` | `src/backend/src/config/database.ts` |
| Backend → Jolpica-F1 | `fetch()`, rate-limited and cached; ingestion CLI only (`npm run ingest`), never per request | `src/backend/src/ingestion/jolpicaClient.ts`, driven by `ingestion/cli.ts` |
| Backend → OpenF1 | `fetch()`; overtakes ingestion script only (`npm run ingest:overtakes`) | `src/backend/src/ingestion/openF1Overtakes.ts`, driven by `scripts/ingestOvertakes.ts` |
| Backend → Groq, then Gemini | `fetch()` to OpenAI-compatible `/chat/completions`; per `POST /api/v1/chat` request, Gemini only as fallback | `src/backend/src/chat/llmClient.ts`, used by `chat/assistant.ts` |

F1 imports and assistant providers use separate paths. The **Jolpica-F1** and **OpenF1** clients are
used only by the ingestion scripts, which load data into Postgres; no API request reaches either
service, and the F1 read models serve from the database. The **chat assistant** makes
request-time provider calls: `POST /api/v1/chat` can call Groq (falling back to Gemini)
when an API key is configured. Missing provider keys produce an unavailable response.
Protected requests also verify identity and read profiles/deletion markers through
Firebase Admin. See [Third-Party Services](third-party-services.md) for what is sent.

Environment variable **names** (configure server credentials outside source control):

- Backend: `PORT`, `CORS_ORIGINS`, `DATABASE_URL`, `DATABASE_CA_CERT`, `FIREBASE_PROJECT_ID`,
  `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, and for the chat assistant `GROQ_API_KEY`,
  `GROQ_MODEL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `CHAT_DAILY_LIMIT`
- Frontend: `VITE_API_BASE_URL` is consumed. Root `VITE_FIREBASE_*` examples are not
  consumed by the hard-coded Firebase initialization module.
- CI: `RAILWAY_TOKEN`, `RAILWAY_PROJECT_ID`, `RAILWAY_SERVICE_ID`; the legacy inert
  Azure file also references `AZURE_WEBAPP_PUBLISH_PROFILE`.

---

## 7. Tests

Backend Vitest/Supertest tests cover statistics, routes, ingestion, chat tools,
validation, authentication, account deletion and submission models. Most route
and model tests mock database/Firebase/provider boundaries. The optional real
PostgreSQL submission suite uses `TEST_DATABASE_URL` and skips without it; Gitea
CI supplies a disposable local database.

Frontend Vitest tests use Testing Library and jsdom for API mapping, cards,
filters, page states, route guards, login/account actions, submitter review,
submissions, qualifying, predictions and chat interaction/persistence. Firebase,
Firestore and API boundaries are mocked. Separate emulator tests exercise
Firestore role/deletion security. Playwright currently has five Chromium tests
for guest redirection and login controls, with no authenticated end-to-end flow.

Run backend `npm test` / `npm run test:coverage` from `src/backend`; frontend
`npm run test:ui:run` / `npm run test:ui:coverage` from `src/frontend`. V8 coverage
reports are configured for both apps, with no minimum thresholds. Rules and
Playwright commands, current measured coverage and test limitations are recorded
in [Testing Overview](testing.md). The root `tests/` folder is not the test entry
point.

---

## 8. CI and deployment

Active pipeline: `.gitea/workflows/ci.yml` (Gitea Actions), on push and pull
requests targeting `main`. Four validation jobs run on `ubuntu-latest`:

1. **frontend** — Node 22, Java 21, `npm ci`, lint/build, Vitest V8 coverage,
   Firestore emulator rules tests and Playwright Chromium smoke tests.
2. **backend** — Node 22, `npm ci`, TypeScript/OpenAPI build, Vitest V8 coverage
   with `TEST_DATABASE_URL` pointing to a disposable local PostgreSQL database.
3. **database** — fresh local PostgreSQL schema, seed and `verify_schema.sql`.
4. **docs** — Python 3.12, documentation requirements and `mkdocs build --strict`.

Coverage artifacts are uploaded with `continue-on-error: true`; report-upload
failures do not bypass the test gates. `deploy_railway` needs all four jobs and
runs only on pushes to `main`, using `RAILWAY_TOKEN`, `RAILWAY_PROJECT_ID` and
`RAILWAY_SERVICE_ID`. It runs `railway up --ci` for the production service. This
workflow does not deploy Firestore rules or automatically run production
migrations.

`workflows/deploy-azure.yml` remains outside `.gitea/workflows/` and
`.github/workflows/`; it describes Azure App Service deployment for the frontend.
The production flow is Browser → [Azure-hosted frontend](https://f1-sport-analytics-ede0h4cfb3augrhn.francecentral-01.azurewebsites.net/)
→ [Railway Express API](https://f1-sport-analytics-api-production.up.railway.app/api/v1)
→ Aiven PostgreSQL. Firebase Authentication and Firestore provide identity,
profiles, and roles. The public MkDocs site is hosted on Netlify.
See [Git Workflow](git-workflow.md) and [Local Setup](setup.md).

---

## 9. Current implementation limits

1. **Data completeness affects results.** Ingestion loads published results and
   event records, but does not guarantee complete race lap logs. Missing pace,
   consistency and gaps must be treated as unavailable. Partial derived
   classifications take precedence over stored full classifications.
2. **Points are Grand Prix totals.** Driver and constructor statistics exclude
   sprint sessions. The derived fallback uses the P1–P10 scale only, without
   fastest-lap bonus, sprint, era or half-point rules.
3. **The UI is centered on 2025.** There is no general season picker. Driver/race
   list helpers request up to 100 records without a season filter; they do not
   traverse all pages. Predictions use whole-season data without a time cutoff.
4. **Identity is split.** Firestore is authoritative for roles; SQL profiles are
   updated on writes. Historical submissions remain with anonymized contributor
   details after account deletion; cleanup may require retrying the CLI.
5. **Schema changes are manual.** Seven ordered SQL migrations exist, but there
   is no migration runner, migration-state table or automatic deployment step.
6. **Browser tests are limited smoke tests.** Mocked UI suites and real SQL/rules
   tests exist, but authenticated analytics/submission/admin journeys are not
   covered by the current Playwright suite. Coverage thresholds are not enforced.
7. **Firebase client configuration is fixed.** `src/auth/firebase.ts` contains
   the shared web configuration; root `VITE_FIREBASE_*` examples are not read.
8. **Chat has availability and persistence limits.** Provider keys are required;
   quotas/rate limits can block replies. The browser conversation is in memory,
   preserved across route navigation and cleared on reload or user change.
9. **Some derivation helpers are not exposed.** Total pit time and running order
   are unit-tested but have no public HTTP endpoint.
10. **Development helpers are PowerShell scripts.** Manual npm/Python commands
    in [Local Setup](setup.md) support contributors using other shells.
11. **The API constructor filter has a SQL alias issue.** Source review found that
    `drivers.model.ts` builds a nonempty `constructor_id` filter against
    `dcl.constructor_id`, while the query joins the current link as `cl`.
    This is expected to fail on PostgreSQL; the route tests mock the model
    and do not cover SQL execution for this filter. The Drivers page filters
    teams locally and does not send this API parameter.

---

## 10. Delivery references

The repository uses Gitea at `sdp.ms.wits.ac.za/eaglestack/SportsAnalytics`;
merged changes are recorded as pull requests. See [Git Workflow](git-workflow.md)
for the delivery process and sprint retrospectives for implementation summaries.

Final-sprint UI changes include `108f570` (race timeline/statistics),
`0baaa9d` (qualifying support), `93a50aa` (assistant widget), and `1df8703`
(qualifying/predictions pages, filters and final UI changes). `9fd1ec9` and
`5ccac18` preserve chat during navigation and clear it on sign-out. The current
CI artifact-upload behavior is recorded by `7aab2f4`.
