# Local Setup

How to get a fresh clone running locally. This page is the short path: the
per-package detail stays in `README.md` and `src/backend/README.md`, which
this page points at rather than repeats. Those live outside the documentation
site, so they are given as repository paths rather than links.

## Prerequisites

| Requirement | Version | Where that comes from |
|---|---|---|
| Node.js | 22.13 or later in the 22.x series | Root `package.json` declares `>=22`, and CI selects Node 22. The frontend lockfile requires at least 22.12 for Vite/Vitest and 22.13 for jsdom. |
| npm | bundled with Node | Lockfiles are committed, so use `npm ci` rather than `npm install`. |
| Aiven PostgreSQL access | — | Needed for the connection string and the CA certificate below. Ask the team for access to the project's Aiven service. |
| Java 21 | optional | Only for the frontend Firestore rules tests, which run under the Firebase emulator. |
| Python 3.12 | optional | Only for building this documentation site. |

On Windows PowerShell, use `Copy-Item .env.example .env` in place of `cp`.
If PowerShell blocks `npm.ps1`, use `npm.cmd` (and `npx.cmd`) for the same
commands without changing the machine's execution policy.

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
variable. Database-backed requests require `DATABASE_URL` (the Aiven
connection string) and the CA certificate covered next. Initialisation is
lazy: the process and the health endpoint can run without them. Protected
submission/account operations also need Firebase Admin credentials.

Paste the Aiven connection string into `DATABASE_URL` **without** its
`?sslmode=require` suffix. `src/backend/src/config/database.ts` already makes
the connection use TLS and verifies the server against Aiven's CA certificate.
If the URL carries `sslmode`, the `pg` driver replaces that TLS setting with
its own, the CA certificate is never used, and the first query fails with:

```
Error: self-signed certificate in certificate chain (SELF_SIGNED_CERT_IN_CHAIN)
```

Remove `sslmode` from the URL to fix it. Do not work around the error by
turning off certificate verification (`rejectUnauthorized: false`,
`sslmode=no-verify` or `NODE_TLS_REJECT_UNAUTHORIZED=0`): that would accept
any server claiming to be the database.

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

Deployed environments (Railway) can set the `DATABASE_CA_CERT` environment
variable instead. Without either source,
startup fails on the first database call with:

```
Database CA certificate is not configured. Set DATABASE_CA_CERT or provide certs/ca.pem.
```

The *Database CA certificate* section of `src/backend/README.md` has the full
explanation, including the `\n` escaping `DATABASE_CA_CERT` expects.

When using the local file, remove or leave blank the `DATABASE_CA_CERT`
placeholder copied from `.env.example`: a nonempty value takes precedence
over `certs/ca.pem`, even if it is still a placeholder.

### Schema and seed

`database/schema.sql` is the consolidated schema for a **fresh, disposable**
database, including account deletion, submissions, result/grid/fastest-lap
fields, indexes, and qualifying results. It creates schema objects and cannot
be rerun over existing objects unchanged. CI loads it, then `database/seed.sql`,
then `database/verify_schema.sql` with
`psql -v ON_ERROR_STOP=1`.

For an existing shared database, use the relevant additive migration files
under `database/migrations` after a backup and review of what is already
applied. Do not run the fresh schema/seed against that database. See
[Database Design](database-design.md) for the model and migration details;
the ingestion commands are in [Jolpica-F1 Pipeline](ingestion/jolpica-ingestion.md)
and [OpenF1 overtakes](ingestion/openf1-overtakes.md).

### Chat assistant (optional)

`POST /api/v1/chat` is an F1 assistant whose factual answers use validated
tools backed by this API's data. It can also give clearly framed opinions
and follow-up explanations. It needs at least one LLM provider key in
`src/backend/.env`:

| Variable | Required | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | One of the two keys | Primary provider. Free key from [console.groq.com/keys](https://console.groq.com/keys). |
| `GROQ_MODEL` | No | Groq model id. Defaults to `openai/gpt-oss-20b`. |
| `GEMINI_API_KEY` | One of the two keys | Fallback provider. Free key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey). |
| `GEMINI_MODEL` | No | Gemini model id. Defaults to `gemini-3.5-flash-lite`. |
| `CHAT_DAILY_LIMIT` | No | Chat requests allowed per UTC day across all users. Defaults to `200`; an invalid value falls back to the default with a warning. |

With neither key set, the endpoint answers `503 SERVICE_UNAVAILABLE` and the
rest of the API works as normal. Any model you choose must support tool
(function) calling. Deployed environments set the same variables in Railway.
See [Third-party services](third-party-services.md) for what is sent to each
provider and the provider configuration.

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

Firebase client configuration is currently declared in
`src/frontend/src/auth/firebase.ts`; `VITE_FIREBASE_*` placeholders do not
override it. `VITE_API_BASE_URL` is a build-time setting, so rebuild the
frontend when changing a deployed API URL. Set backend `CORS_ORIGINS` to a
comma-separated list that includes the frontend's exact origin.

`setup.ps1` installs both packages with `npm install`; `start.ps1` starts
only the frontend. The setup script's Neon message is historical: the
current database configuration requires the Aiven CA. Neither script
creates environments, applies migrations, nor starts a local backend.

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
npm run test:ui:run
npm run test:ui:coverage
npx --yes firebase-tools emulators:exec --only firestore --project demo-member4-roles "npm run test:rules"
npx playwright install chromium
npm run test:e2e      # Playwright smoke test
```

Documentation, from the repository root:

```bash
pip install -r requirements-docs.txt
mkdocs build --strict
```

These match the package checks in `.gitea/workflows/ci.yml`. CI also supplies
a disposable local PostgreSQL database through `TEST_DATABASE_URL` for the
submission integration suite, which skips when that variable is unset,
and separately validates the fresh schema/seed. On Linux, CI installs
Chromium system dependencies with `npx playwright install --with-deps chromium`.
See
[Testing Overview](testing.md) for what each layer covers.

## Where to go next

- [API Design](api-design.md) — the endpoint contract the backend implements.
- [Database Design](database-design.md) and [Data Model](data-model.md).
- [Jolpica-F1 Pipeline](ingestion/jolpica-ingestion.md) — loading real season
  data.
- [Git Workflow](git-workflow.md) — branching and review before you open a
  pull request.
