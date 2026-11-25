# Backend

F1 Sport Analytics — backend API and derivation engine. Implements the contract in [`../../docs/api-design.md`](../../docs/api-design.md).

## Install

```bash
npm install
```

## Run (dev)

```bash
cp .env.example .env   # first time only
npm run dev
```

Anything that touches the database also needs Aiven's CA certificate at
`certs/ca.pem` — see [Database CA certificate](#database-ca-certificate) below.

Starts the server with `tsx watch` — restarts on file changes. Defaults to `http://localhost:3001`.

```bash
curl http://localhost:3001/api/v1/health
# { "data": { "status": "ok" }, "meta": {} }
```

## Test

```bash
npm test
```

Runs the Vitest suite once (`vitest run`).

## Build / run compiled

```bash
npm run build   # tsc -> dist/
npm start       # node dist/index.js
```

## Environment variables

See [`.env.example`](.env.example).

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | Port the server listens on. |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated frontend origins allowed by CORS. Same-host requests (including Swagger UI) and requests without `Origin` are also accepted. |
| `DATABASE_URL` | — | Aiven for PostgreSQL connection string, from **Connection information** in the [Aiven console](https://console.aiven.io/). Remove any `?sslmode=...` query parameter; `database.ts` configures TLS explicitly with Aiven's CA certificate. |
| `DATABASE_CA_CERT` | — | Aiven's CA certificate as the PEM contents on one line, newlines escaped as `\n`. Supports environments such as Railway without a local certificate file; otherwise `certs/ca.pem` is used. |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | — | Firebase Admin service-account credentials for token verification, profile access and account cleanup. Escaped private-key newlines are restored. |
| `GROQ_API_KEY`, `GEMINI_API_KEY` | — | Optional chat providers, tried in that order. No keys means `/chat` returns `503`; other routes remain available. |
| `GROQ_MODEL` | `openai/gpt-oss-20b` | Optional primary model override. |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Optional fallback model override. |
| `CHAT_DAILY_LIMIT` | `200` | Positive integer chat requests per UTC day per process; blank/invalid values use the default. |

`.env` is gitignored — never commit it.

## Database CA certificate

Aiven signs its PostgreSQL services with a per-project CA that is not in the
system trust store, so [`src/config/database.ts`](src/config/database.ts)
verifies the connection against that CA explicitly. It looks in two places, in
order:

1. `DATABASE_CA_CERT` — the PEM contents on a single line with every newline
   written as a literal `\n`. `database.ts` unescapes them back to real
   newlines. This allows Railway to supply it through environment configuration.
2. `certs/ca.pem`, resolved relative to the process working directory — so
   `src/backend/certs/ca.pem` when the backend is run from this directory, as
   the commands above do.

Download the file once from the Aiven console: select the PostgreSQL service,
open **Connection information** on its Overview page, and download **CA
certificate** (`ca.pem`). Save it to `certs/ca.pem` here.

Clear or remove the copied `.env.example` value of `DATABASE_CA_CERT` when using
the local file; a non-empty environment value takes precedence.

```bash
mkdir -p certs
# move the downloaded ca.pem into certs/ca.pem
```

**Never commit it.** `certs/` and `*.pem` are in the repository `.gitignore`;
every developer and every environment downloads its own copy.

With neither source configured, the first database call fails with:

```
Database CA certificate is not configured. Set DATABASE_CA_CERT or provide certs/ca.pem.
```

## Layout

```
src/
├── index.ts        entry point: dotenv + listen
├── app.ts          builds the Express app (cors, json, /api/v1 mount, 404 + error handler)
├── routes/          URL → handler mapping
├── controllers/      read req, validate query, call model, send res — no business logic
├── services/        pure statistics/validation plus account-deletion orchestration
├── models/          data access
├── middleware/       auth, roles, chat rate limiting, error handling
├── chat/            provider fallback, read-only tools and reply formatting
├── ingestion/       Jolpica mapping/writer and OpenF1 position-change importer
├── scripts/         ingestion and account-cleanup commands
├── utils/           pagination, query validation, CSV and TTL cache helpers
└── types/           shared snake_case types for the entities in data/sample/*.json and database/schema.sql
```

`services/` must never import `express` or touch `req`/`res` — that boundary is what keeps the derivation engine testable without spinning up an HTTP server.

`app.ts` is split from `index.ts` so tests can exercise routes over supertest without binding a port. `index.ts` is the only place that calls `listen()`.

## Endpoints

Implemented (all paths below are under `/api/v1`; see [`API Design`](../../docs/api-design.md) and [`OpenAPI`](../../docs/api/openapi.yaml)):

| Endpoint | Filters |
|---|---|
| `GET /api/v1/health` | — |
| `GET /api/v1/drivers` | `constructor_id`, `nationality`, `search` |
| `GET /api/v1/drivers/:driver_id` | — |
| `GET /api/v1/races` | `season`, `has_sprint`, `search` |
| `GET /api/v1/races/:grand_prix_id` | — |
| `GET /api/v1/races/:grand_prix_id/laps` | `driver_id`, `session_type` |
| `GET /api/v1/races/:grand_prix_id/events` | `driver_id`, `type`, `session_type` |
| `GET /api/v1/drivers/:driver_id/stats` | `season` (required) |
| `GET /api/v1/races/:grand_prix_id/statistics` | — |
| `GET /api/v1/races/:grand_prix_id/qualifying` | — |
| `GET /api/v1/constructors/:constructor_id/stats` | `season` (required) |
| `GET /api/v1/export/:dataset` | `format=csv\|json` (default JSON), `season` (required for results/laps) |
| `POST /api/v1/chat` | Strict `messages` body; public, rate limited |
| `POST /api/v1/submissions` | Approved submitter/admin; strict event body |
| `GET /api/v1/submissions` | Approved submitter's own records/admin queue; optional `status` |
| `GET /api/v1/submissions/mine` | Any authenticated owner's history; optional `status` |
| `GET /api/v1/submissions/:submission_id` | Owner/admin |
| `PATCH /api/v1/submissions/:submission_id` | Admin review; `accepted`/`rejected` and `validation_errors` |
| `DELETE /api/v1/users/me` | Firebase token; authentication within five minutes |

Drivers, races, laps and events take `page` and `per_page` (max 100, clamped). Submission lists and exports are unpaginated. Submission lists accept only `status` and reject other query fields. Interactive documentation is public at `/api/docs`, with `/api/openapi.yaml` and `/api/openapi.json` downloads. `npm run build` compiles TypeScript and copies the YAML into `dist/openapi.yaml` for deployed serving.

## Derivation engine

Statistics functions are pure — no Express, `req`/`res`, file or database access — taking loaded laps/events/result facts and returning computed values. The account-deletion service separately coordinates provider/database I/O.

| File | Functions |
|---|---|
| `services/lapStatistics.ts` | `averageLapTime`, `fastestLap`, `lapConsistency` |
| `services/pitStatistics.ts` | `pitStopCount`, `totalPitTime` |
| `services/runningOrder.ts` | `runningOrderAtLap` |
| `services/raceStatistics.ts` | composes `GET /races/:id/statistics` |
| `services/driverStatistics.ts` | composes `GET /drivers/:id/stats` |
| `services/constructorStatistics.ts` | per-result constructor points and chat standings |
| `services/driverStandings.ts` | ranking reused by the chat assistant |

See [`F1 Statistics`](../../docs/f1-statistics.md) for derivations and limitations. Published `race_results.points` is preferred; classified position, grid and fastest-lap facts supplement missing telemetry. Race classification falls back as a whole only when no rows can be derived. Pace/consistency need lap timing, and derived gaps need complete logs. All driver/constructor season totals and chat standings use `RACE` sessions only, excluding sprints.

The `session_result` block in `data/sample/events.json` is a **reference for checking derivations against, never a source** — no model serves it and no service reads it.

## Data source

The models query PostgreSQL against [`schema.sql`](../../database/schema.sql). `sampleData.ts` remains for fixtures/helpers; runtime models no longer load bundled sample JSON. Accepted submissions publish an envelope and normalized row atomically; the event reader combines envelopes with source/legacy rows whose `submission_id IS NULL`, avoiding duplicate events.

The Jolpica CLI imports results, qualifying, pit stops and retirements; OpenF1 position changes are a separate command. Neither persists a full lap-timing feed. From this directory:

```bash
npm run ingest -- --season 2025 --dry-run
npm run ingest:overtakes -- --season 2025 --dry-run
```

Jolpica dry runs read cached responses or fetch source data and need no database. OpenF1 dry runs also read the configured database and therefore need its URL/CA and network access. See [Jolpica ingestion](../../docs/ingestion/jolpica-ingestion.md) and [OpenF1 ingestion](../../docs/ingestion/openf1-overtakes.md) before a write run.

Firebase Admin verifies ID tokens with revocation checking and authorizes against Firestore profiles; SQL users mirror identity/roles for submission foreign keys. Account deletion records durable tombstones and preserves SQL submission relationships while anonymizing contact fields. `index.ts` retries pending cleanup at startup and every minute when `DATABASE_URL` is configured.

The chat assistant uses eleven internal read-only tools, including standings, team-driver lookup and disqualification counts, through the same SQL loaders/statistics functions as the public API. There are no standalone standings/disqualification routes. It has ten-minute process-local caches and limits of ten requests per IP per minute plus the configured daily cap. See [Third-Party Services](../../docs/third-party-services.md) for provider configuration, data use and fallback behaviour.

## Status

Final-sprint implementation: SQL reads and reviewed submissions, derived statistics with published-data fallbacks, qualifying, dataset exports and the chat assistant are mounted. Health is a static liveness check; it does not verify PostgreSQL, Firebase or provider readiness. The proposed profile/submitter-request/admin HTTP routes in API Design remain unmounted and those operations still use Firestore.
