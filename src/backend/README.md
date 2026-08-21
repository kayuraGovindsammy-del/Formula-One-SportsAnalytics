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
| `CORS_ORIGIN` | — | Origin allowed by CORS (the frontend dev server URL, e.g. `http://localhost:5173`). |
| `DATABASE_URL` | — | Postgres connection string. Not wired up yet — placeholder for when `models/` starts talking to the database defined in [`../../database/schema.sql`](../../database/schema.sql). |

`.env` is gitignored — never commit it.

## Layout

```
src/
├── index.ts        entry point: dotenv + listen
├── app.ts          builds the Express app (cors, json, /api/v1 mount, 404 + error handler)
├── routes/          URL → handler mapping
├── controllers/      read req, validate query, call model, send res — no business logic
├── services/        business logic and derivation — no express, no req/res (empty until the stats endpoints)
├── models/          data access
├── middleware/       ApiError, errorHandler, notFoundHandler, asyncHandler
├── utils/           pagination + query-validation helpers
└── types/           shared snake_case types for the entities in data/sample/*.json and database/schema.sql
```

`services/` must never import `express` or touch `req`/`res` — that boundary is what keeps the derivation engine testable without spinning up an HTTP server.

`app.ts` is split from `index.ts` so tests can exercise routes over supertest without binding a port. `index.ts` is the only place that calls `listen()`.

## Endpoints

Implemented (`docs/api-design.md` §4):

| Endpoint | Filters |
|---|---|
| `GET /api/v1/health` | — |
| `GET /api/v1/drivers` | `constructor_id`, `nationality`, `search` |
| `GET /api/v1/drivers/:driver_id` | — |
| `GET /api/v1/races` | `season`, `has_sprint`, `search` |
| `GET /api/v1/races/:grand_prix_id` | — |
| `GET /api/v1/races/:grand_prix_id/laps` | `driver_id`, `session_type` |
| `GET /api/v1/races/:grand_prix_id/events` | `driver_id`, `type`, `session_type` |

All list endpoints take `page` and `per_page` (max 100, clamped). Not yet implemented: §4.3 driver stats and §4.8 race statistics — the derived endpoints.

## Data source

The `models/` layer currently reads `data/sample/*.json`, loaded once at startup. **This is a Sprint 1 placeholder** — each model file carries a header comment marking it as such. The function signatures (`async`, filter + page options in, `{ rows, total_items }` out) are the contract that must survive the swap to Postgres queries against [`../../database/schema.sql`](../../database/schema.sql); nothing above `models/` should need to change.

## Status

Sprint 1. Read endpoints done, derived-statistics endpoints next.
