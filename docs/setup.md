# Local Setup

How to get a fresh clone running locally. This page is the short path: the
per-package detail stays in `README.md` and `src/backend/README.md`, which
this page points at rather than repeats. Those live outside the documentation
site, so they are given as repository paths rather than links.

## Prerequisites

| Requirement | Version | Where that comes from |
|---|---|---|
| Node.js | 22 | Root `package.json` declares `"engines": { "node": ">=22" }`, and every job in `.gitea/workflows/ci.yml` pins `node-version: '22'`. |
| npm | bundled with Node | Lockfiles are committed, so use `npm ci` rather than `npm install`. |
| Aiven PostgreSQL access | — | Needed for the connection string and the CA certificate below. Ask the team for access to the project's Aiven service. |
| Java 21 | optional | Only for the frontend Firestore rules tests, which run under the Firebase emulator. |
| Python 3.12 | optional | Only for building this documentation site. |

> `README.md` currently states Node.js 20 LTS. The root `package.json` and CI
> both use 22 — that is the version to install. Correcting the README is
> tracked separately.

## Clone

```bash
git clone <repository-url>
cd SportsAnalytics
```

## Backend

From the repository root:

```bash
cd src/backend
npm ci
cp .env.example .env
```

Fill in `.env` from the template. `src/backend/.env.example` documents every
variable; the ones you cannot start without are `DATABASE_URL` (the Aiven
connection string) and the CA certificate covered next.

### Database CA certificate

The database is Aiven for PostgreSQL. Aiven enforces TLS and signs its
services with a per-project CA that is not in the system trust store, so the
backend verifies against that CA explicitly and fails its first database call
without it.

1. Open the [Aiven console](https://console.aiven.io/) and select the
   PostgreSQL service.
2. On the service's **Overview** page, under **Connection information**,
   download the **CA certificate** — the file is named `ca.pem`.
3. Save it as `src/backend/certs/ca.pem`.

```bash
mkdir -p certs
# move the downloaded ca.pem into certs/ca.pem
```

**Never commit the certificate.** `certs/` and `*.pem` are in `.gitignore`;
each developer and each environment downloads its own copy.

Deployed environments (Railway) have no checkout to read the file from and set
the `DATABASE_CA_CERT` environment variable instead. Without either source,
startup fails on the first database call with:

```
Database CA certificate is not configured. Set DATABASE_CA_CERT or provide certs/ca.pem.
```

The *Database CA certificate* section of `src/backend/README.md` has the full
explanation, including the `\n` escaping `DATABASE_CA_CERT` expects.

### Chat assistant (optional)

`POST /api/v1/chat` is a small F1 assistant that answers only from this API's
own data. It needs at least one LLM provider key in `src/backend/.env`:

| Variable | Required | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | One of the two keys | Primary provider. Free key from [console.groq.com/keys](https://console.groq.com/keys). |
| `GROQ_MODEL` | No | Groq model id. Defaults to `openai/gpt-oss-20b`. |
| `GEMINI_API_KEY` | One of the two keys | Fallback provider. Free key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey). |
| `GEMINI_MODEL` | No | Gemini model id. Defaults to `gemini-3.5-flash-lite`. |

With neither key set, the endpoint answers `503 SERVICE_UNAVAILABLE` and the
rest of the API works as normal. Any model you choose must support tool
(function) calling. Deployed environments set the same variables in Railway.
See [Third-party services](third-party-services.md) for what is sent to each
provider and the free-tier terms.

### Run it

```bash
npm run dev
```

Run the backend from `src/backend`. `src/backend/src/config/database.ts`
resolves `certs/ca.pem` relative to the process working directory, so starting
it from anywhere else will not find the certificate.

Defaults to `http://localhost:3001`:

```bash
curl http://localhost:3001/api/v1/health
# { "data": { "status": "ok" }, "meta": {} }
```

## Frontend

From the repository root:

```bash
cd src/frontend
npm ci
cp .env.example .env
npm run dev
```

`src/frontend/.env.example` points `VITE_API_BASE_URL` at the deployed API. To
develop against your local backend, set it to the local URL instead:

```bash
VITE_API_BASE_URL=http://localhost:3001/api/v1
```

The root `.env.example` holds frontend Firebase variables only and is not read
by either package at runtime — the backend loads its own `src/backend/.env`,
and Vite loads `src/frontend/.env`.

## Run the tests

Backend, from `src/backend`:

```bash
npm test              # vitest, single run
npm run test:coverage # the variant CI runs
npm run build         # tsc
```

Frontend, from `src/frontend`:

```bash
npm run lint
npm run build
npm run test:rules    # Firestore rules, needs the Firebase emulator and Java 21
npm run test:e2e      # Playwright smoke test
```

Documentation, from the repository root:

```bash
pip install -r requirements-docs.txt
mkdocs build --strict
```

These are the same checks `.gitea/workflows/ci.yml` runs, so a clean local run
is a good predictor of a green pipeline. See
[Testing Overview](testing.md) for what each layer covers.

## Where to go next

- [API Design](api-design.md) — the endpoint contract the backend implements.
- [Database Design](database-design.md) and [Data Model](data-model.md).
- [Jolpica-F1 Pipeline](ingestion/jolpica-ingestion.md) — loading real season
  data.
- [Git Workflow](git-workflow.md) — branching and review before you open a
  pull request.
