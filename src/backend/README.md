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
├── index.ts        Express app: dotenv, cors, json, /api/v1 mount, 404 + error handler
├── routes/          URL → handler mapping
├── controllers/      read req, call service, send res — no business logic
├── services/        business logic and derivation — no express, no req/res
├── models/          data access (Postgres, once wired up)
├── middleware/       ApiError, errorHandler, notFoundHandler, asyncHandler
└── types/           shared snake_case types for the entities in data/sample/*.json and database/schema.sql
```

`services/` must never import `express` or touch `req`/`res` — that boundary is what keeps the derivation engine testable without spinning up an HTTP server.

## Status

Sprint 1 scaffold. Only `GET /api/v1/health` is implemented. Data endpoints from `docs/api-design.md` §4 come next.
