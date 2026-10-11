# F1 Sport Analytics Frontend

The frontend uses React, TypeScript, Vite and React Router. Firebase Authentication
and Firestore provide identity and application roles; Formula 1 data, submissions,
account deletion, exports and assistant replies use the custom Express API.
Recharts renders the statistics charts.

## Local development

From this directory, using Node.js 22.13 or later within the 22.x series (the
locked frontend tools require a newer version than the root `>=22` minimum):

```bash
npm ci
```

Copy `.env.example` to `.env`. The example uses the hosted Railway API. To use the
local backend, set:

```env
VITE_API_BASE_URL=http://localhost:3001/api/v1
```

Restart Vite after changing the environment, then run:

```bash
npm run dev
```

Open `http://localhost:5173`. Run the backend separately for local API access;
see [Local Setup](../../docs/setup.md) for database, certificate and backend
configuration. `npm run build` runs TypeScript checks and creates `dist/`;
`npm run preview` serves that build locally.

The Firebase web configuration is currently defined directly in
`src/auth/firebase.ts`. The root `.env.example` lists `VITE_FIREBASE_*` variables,
but this module does not read them. To use a different Firebase project, update
that configuration and configure its Google and Email/Password providers,
authorized domains and Firestore rules. Server-side Firebase credentials belong
in the backend environment.

## Current pages and access

`src/App.tsx` defines the routes. Analytics pages, Account and My Submissions
require sign-in. The login page supports Google sign-in, email registration and
sign-in, and password reset. New profiles begin with `USER` and submitter status
`none`; roles come from a live Firestore profile subscription.

| Page | Route | Access / behavior |
|---|---|---|
| Dashboard | `/` | Season summary, race spotlight and contributor links |
| Drivers and driver details | `/drivers`, `/drivers/:id` | Search/team filters, points ranks and season statistics |
| Races and race details | `/races`, `/races/:id` | Search, classification and filtered race-event timeline |
| Qualifying | `/races/:id/qualifying` | Q1/Q2/Q3 classification and pole information |
| Predictions | `/races/:id/predictions` | Client-side estimate from qualifying and season statistics |
| Constructors | `/constructors` | Team cards sorted by API points |
| Statistics | `/statistics` | Race charts and two-driver season comparison |
| Account | `/account` | Request/re-request submitter access, sign out and delete account |
| My Submissions | `/my-submissions` | Own records, status filter and review reasons |
| Submit Data | `/submit` | Approved `SUBMITTER` or `ADMIN`; one validated event per request |
| Requests and Reviews | `/admin/submitter-requests`, `/admin/submissions` | `ADMIN` only |

Unauthorized visitors go to `/login`; signed-in users without the required role
go to `/`. These guards control the UI; Firestore rules and backend authorization
enforce the corresponding data access.

The UI targets 2025 and has no general season selector. Driver/race list helpers
request the first page of up to 100 records without a season filter. Statistics
default to the first returned race. Predictions use a fixed 60/40 weighting of
qualifying position and whole-season average finish; the API has no pre-race
cutoff, so the inputs can include the selected race and later results. These are
analytical estimates with no demonstrated prediction-accuracy measurement.

CSV/JSON downloads link directly to season export endpoints. Races offers calendar
and season-wide results downloads; Drivers and Constructors offer their respective
datasets. Lap exports are available through the API. The floating F1 Assistant is
available on every page, including login. Its in-memory conversation survives navigation
and closing the panel, and resets on reload, sign-out or a change of user.

## Source layout

- `src/auth/`: Firebase initialization, profile state, submitter transactions and
  route guards.
- `src/data/f1Data.ts`: API reads and snake_case-to-camelCase mapping;
  `src/api/`: authenticated submissions, export URLs and public chat requests.
- `src/pages/`: routed screens; `src/components/`: cards, layout, timeline,
  downloads and chat.
- `src/**/*.test.tsx` and `src/**/*.test.ts`: Vitest UI and API-client tests.
- `tests/firestore.roles.test.mjs`: Firestore rules tests using the emulator.
- `e2e/navigation.spec.ts`: Playwright unauthenticated-navigation smoke tests.

## Validation

From this directory:

```bash
npm run lint
npm run build
npm run test:ui:run
npm run test:ui:coverage
```

`npm run test:ui` runs Vitest in watch mode. The suite uses Testing Library and
jsdom with mocked authentication, API and Firestore boundaries. V8 coverage is
written to `coverage/` as text, HTML and JSON summary; the configuration has no
minimum coverage threshold.

Rules tests require Java 21 and the Firebase Firestore emulator. From this
directory, the same command used in Gitea CI is:

```bash
npx --yes firebase-tools emulators:exec --only firestore --project demo-member4-roles "npm run test:rules"
```

For Playwright:

```bash
npx playwright install chromium
npm run test:e2e
```

Playwright starts (or reuses) Vite at `http://localhost:5173` and runs Chromium
only. Its five tests check guest redirection and login controls; they do not
exercise a successful Firebase login, analytics API integration, submission
publication or administrator review. See [Testing Overview](../../docs/testing.md)
for the complete project testing strategy.
