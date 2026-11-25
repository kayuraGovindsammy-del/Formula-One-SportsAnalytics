# Formula 1 Sport Analytics Platform

A Formula 1 sport analytics platform developed for COMS3011A.

- Production application: [Azure](https://f1-sport-analytics-ede0h4cfb3augrhn.francecentral-01.azurewebsites.net/)
- Interactive API documentation (Swagger UI): [https://f1-sport-analytics-api-production.up.railway.app/api/docs](https://f1-sport-analytics-api-production.up.railway.app/api/docs)

The project supports exploration of Formula 1 drivers, constructors, races, event data, and derived statistics. It also includes authenticated users, approved data submitters, and administrative review of submission records.

## Project Overview

This project brings together a React frontend, a hand-written Express API, Firebase Authentication, and a PostgreSQL-backed data model for Formula 1 race analytics. The application is intended to help users understand the sport through driver, race, and session-level data while also supporting a structured submission workflow for approved contributors.

The current implementation covers:

- Formula 1 drivers and constructors
- race and session metadata
- race/event data and derived statistics
- external Formula 1 data from Jolpica and OpenF1
- authenticated user roles and submitter approval states
- administrative review of data submissions
- qualifying results and a frontend performance forecast
- CSV/JSON dataset downloads and a floating F1 Assistant

## Technology Stack

### Frontend
- React
- TypeScript
- Vite
- Firebase Authentication
- Firestore for user profiles, roles, and submitter approval status
- Recharts for statistics charts

### Backend
- Node.js
- Express
- TypeScript
- Firebase Admin SDK
- PostgreSQL

### Repository and Collaboration
- Gitea
- Git

## Architecture

The project uses a custom backend and shared PostgreSQL database for Formula 1 application data, while Firebase Authentication is used for identity and access control. The application data itself is accessed through the team’s Express API rather than Firebase-generated database endpoints.

```text
Browser
      |
      v
Azure-hosted React Frontend
      |
      v
Railway-hosted Express API (Node.js + TypeScript)
      |
      +---------------------------+
      |                           |
      v                           v
Firebase Authentication      Aiven PostgreSQL
Identity + access control    Formula 1 data + app data
Firestore roles/profiles    Submissions
```

The production flow is Browser → Azure frontend → Railway API → Aiven
PostgreSQL. Firebase Authentication and Firestore provide identity, profiles
and roles.

The frontend is a Vite + React application, and the backend is a hand-written Express API. The current codebase uses Firebase Authentication and Firebase Admin for identity-related flows, while the main project data model and submission records are handled through the backend and PostgreSQL.

The frontend reads profiles and submitter requests directly from Firestore. The backend verifies Firebase ID tokens and reads those profiles for protected submissions and account deletion. Public read/export routes and `POST /api/v1/chat` do not require a token. The assistant calls Groq, with Gemini as a fallback, using validated tools backed by the project's own data.

## Repository Structure

The repository is organised as follows:

- `src/frontend` — React + TypeScript frontend application
- `src/backend` — Express + TypeScript backend API and business logic
- `database` — PostgreSQL schema and seed data
- `data` — sample Formula 1 data files used by the project
- `docs` — API, auth, data-model, design, and project-process documentation
- `tests` — repository test space for project validation
- `mkdocs.yml` and `requirements-docs.txt` — MkDocs documentation configuration

## Prerequisites

Before setting up the project locally, make sure you have:

- Git
- Node.js 22, at least 22.13 (CI uses 22; the root declares `>=22`, but locked frontend tooling requires a later 22.x release)
- npm
- Python 3.12 (used in the docs CI environment for MkDocs builds; match this locally if you want to mirror CI)

## Clone and Setup

```bash
git clone <repository-url>
cd SportsAnalytics
```

## Frontend Setup

From the project root:

```bash
cd src/frontend
npm ci
```

The Vite frontend expects its environment file in `src/frontend/.env`. The repository includes the template at `src/frontend/.env.example`, and the frontend currently reads `VITE_API_BASE_URL` from Vite environment variables in `src/frontend/src/data/f1Data.ts`. The frontend code does not currently read `VITE_FIREBASE_*` variables at runtime.

Create the local environment file as follows:

```bash
cp .env.example .env
```

If you need to override the API base URL locally, set:

```bash
VITE_API_BASE_URL=http://localhost:3001/api/v1
```

Start the frontend in development mode:

```bash
npm run dev
```

Useful validation commands:

```bash
npm run lint
npm run build
```

## Backend Setup

From the project root:

```bash
cd src/backend
npm ci
```

Create a local environment file from the provided template if needed:

```bash
cp .env.example .env
```

The backend expects the following environment variables in its local environment:

```bash
PORT=3001
CORS_ORIGINS=http://localhost:5173
DATABASE_URL=postgres://avnadmin:YOUR_PASSWORD@YOUR_SERVICE-YOUR_PROJECT.a.aivencloud.com:YOUR_PORT/defaultdb
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-firebase-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
```

These settings correspond to the backend configuration in `src/backend/src/index.ts`, `src/backend/src/app.ts`, `src/backend/src/config/database.ts`, and `src/backend/src/config/firebaseAdmin.ts`.

Copy the Aiven connection string without its `sslmode` query parameter so the explicit CA verification remains in effect. The optional assistant variables (`GROQ_API_KEY`, `GEMINI_API_KEY`, model overrides, and `CHAT_DAILY_LIMIT`) are described in `src/backend/.env.example` and `docs/setup.md`.

### Database CA certificate (required)

The database is Aiven for PostgreSQL. Aiven enforces TLS and signs its
services with a per-project CA that is not in the system trust store, so the
backend verifies the connection against that CA explicitly and will not start
a database-backed request without it.

Download it once:

1. Open the [Aiven console](https://console.aiven.io/) and select the
   PostgreSQL service.
2. On the service's **Overview** page, find **Connection information**.
3. Download **CA certificate** — the file is named `ca.pem`.
4. Save it as `src/backend/certs/ca.pem`.

```bash
mkdir -p certs
# move the downloaded ca.pem into certs/ca.pem
```

`src/backend/src/config/database.ts` resolves `certs/ca.pem` relative to the
process working directory, so run the backend from `src/backend` (as the
commands in this section do) for the local file to be found.

If you copied `.env.example`, clear or remove its `DATABASE_CA_CERT` placeholder
when using the local file; a non-empty environment value takes precedence.

**Never commit the certificate.** `certs/` and `*.pem` are in `.gitignore`;
each developer and each environment downloads its own copy.

Deployed environments (Railway) can supply `DATABASE_CA_CERT` instead — the PEM contents on a single line with
every newline written as a literal `\n`, which `database.ts` unescapes before
use. `DATABASE_CA_CERT` takes precedence when both are present, which also
makes it a usable local override if you would rather not keep the file.

Without either, the backend fails on its first database call with:

```
Database CA certificate is not configured. Set DATABASE_CA_CERT or provide certs/ca.pem.
```

Start the backend locally:

```bash
npm run dev
```

Build and test the backend:

```bash
npm run build
npm test
```

> Current automated backend tests can execute without real production Firebase or PostgreSQL credentials because the Firebase Admin and database initialisation are lazy. The application still requires those values when the relevant production features are actually used, but the tests do not fail at import time just because credentials are not populated in a local or CI environment.

## Validation and Testing

Run the project checks with the actual repository scripts:

### Frontend

```bash
cd src/frontend
npm run lint
npm run build
npm run test:ui:coverage
npx --yes firebase-tools emulators:exec --only firestore --project demo-member4-roles "npm run test:rules"
npx playwright install chromium
npm run test:e2e
```

### Backend

```bash
cd src/backend
npm run build
npm test
```

### Documentation

The project documentation is built using MkDocs. On Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-docs.txt
mkdocs build --strict
```

On Unix-like shells, use the equivalent commands with `source .venv/bin/activate`.

## Documentation

The public project documentation site is:

https://eagle-stack-documentation.netlify.app/

The project documentation is configured as an MkDocs site using `mkdocs.yml` and `requirements-docs.txt`.

The repository also contains the project documentation in `docs/`, including:

- `docs/git-workflow.md`
- `docs/methodology.md`
- `docs/api-design.md`
- `docs/auth-and-submission-workflow.md`
- `docs/data-model.md`
- `docs/database-design.md`
- `docs/event-schema.md`
- `docs/f1-statistics.md`

## Git Contribution Workflow

The project uses a lightweight Git workflow built around `main` and short-lived `feature/...` branches:

```text
issue/task → latest main → feature branch → meaningful commits → push → Pull Request → peer review → merge into main
```

The full process is documented in `docs/git-workflow.md`. This project does not use a separate `develop` branch.

## CI and Automation

The repository includes a Gitea CI workflow at `.gitea/workflows/ci.yml`. It is configured to run on pushes to `main` and on pull requests targeting `main`.

The workflow defines four validation jobs (Node.js 22 for the application jobs):

- frontend lint, build, Vitest coverage, Firestore emulator rules tests (Java 21), and five Playwright login-page smoke tests
- backend build and Vitest coverage, including submission integration tests against a disposable local PostgreSQL database
- fresh PostgreSQL schema, seed, and required-object verification
- MkDocs strict documentation build

This gives the project a repeatable validation pipeline for the main branch and pull-request review flow.

Frontend and backend coverage reports are uploaded as artifacts on a best-effort basis (`continue-on-error: true`); the validation commands remain blocking. After all four validation jobs succeed, pushes to `main` trigger the Railway backend deployment job. Pull requests do not deploy.

## Deployment

The production application is deployed and operational at [f1-sport-analytics-ede0h4cfb3augrhn.francecentral-01.azurewebsites.net](https://f1-sport-analytics-ede0h4cfb3augrhn.francecentral-01.azurewebsites.net/). The frontend is hosted on Azure; the backend API is deployed to Railway and uses Aiven for PostgreSQL. The frontend template points to `https://f1-sport-analytics-api-production.up.railway.app/api/v1`.

The active Gitea workflow in `.gitea/workflows/ci.yml` deploys the backend with `railway up --ci` after all four validation jobs succeed, using `RAILWAY_TOKEN`, `RAILWAY_PROJECT_ID`, and `RAILWAY_SERVICE_ID` secrets. The root build/start scripts delegate to `src/backend`; the build also packages the OpenAPI specification. Runtime configuration requires the Aiven connection/CA, Firebase Admin credentials for protected operations, allowed CORS origins, and optional chat provider keys. `workflows/deploy-azure.yml` describes Azure App Service deployment for the frontend; it is separate from the Gitea backend deployment workflow.

The public documentation site is available at https://eagle-stack-documentation.netlify.app/.

## Project Management

The project uses Taiga for Agile/Scrum planning, backlog management, Sprint tracking, and task ownership. Gitea is used for source control, feature branches, Pull Requests, peer review, and repository-level validation. The detailed division of responsibilities is described in `docs/methodology.md` and `docs/git-workflow.md`.

Taiga project: https://tree.taiga.io/project/andrianos-mastrokolias-f1-analytics-system/

## AI Usage

AI tools were used during the development of this project in accordance with the course AI usage policy.

The following tools were used for code generation, review, development, and documentation assistance:

- **Claude Code — Claude Sonnet 5, Claude Opus 4.5, Claude Opus 5**
  - Assisted with code generation and code review.
- **Claude Web — Claude Sonnet 5**
  - Assisted with code generation during development.
- **ChatGPT Web — GPT-5.6 Sol**
  - Assisted with frontend and backend code generation, integration, and debugging.
- **OpenAI Codex — Default model selection**
  - Used through VS Code for code and documentation assistance, repository inspection, and validation.
- **GitHub Copilot Chat — Auto model selection**
  - Used in VS Code for in-editor assistance and documentation work.

### Human Responsibility

All AI-assisted changes were reviewed, tested, and integrated by the project team. The team remains responsible for the final implementation and submitted work.
