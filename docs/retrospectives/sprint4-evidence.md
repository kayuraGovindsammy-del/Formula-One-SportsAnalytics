# Sprint 4 Final Delivery Evidence

This page summarizes final-sprint implementation and meeting outcomes. October changes represent the final delivery period.

## 1. Scope and sprint attribution

The [Sprint 3 evidence page](sprint3-evidence.md) records the late-September delivery period. This page groups subsequent October changes as final-sprint evidence.

## 2. Current implementation additions

| Workstream | Implemented change | Supporting history and files |
| --- | --- | --- |
| Race/statistics UI | Race details gained a timeline and richer results/event presentation; the Statistics page gained broader rankings, sorting, and charts. Driver details now show season points. | `108f570` (PR #127), `099de88` (PR #134); `src/frontend/src/components/RaceTimeline.tsx`, `src/frontend/src/pages/Statistics/Statistics.tsx`, `src/frontend/src/pages/DriverDetails/DriverDetails.tsx`. |
| Qualifying | Qualifying results gained ingestion, a PostgreSQL table/model, `GET /api/v1/races/:id/qualifying`, and frontend presentation. The final UI adds a dedicated qualifying detail route with tests. | `0baaa9d` (PR #128), `1df8703` (PR #141); `database/migrations/007_qualifying_results.sql`, `src/backend/src/models/qualifyingResults.model.ts`, `src/frontend/src/pages/QualifyingDetails/QualifyingDeatils.tsx`. |
| Predictions | A predictions detail page combines qualifying positions/times with available driver-season average finish and pace. It uses fixed frontend weights and a qualifying-to-race pace factor, with fallbacks when driver statistics are unavailable. It is an illustrative estimate; no validated predictive accuracy is recorded. | `1df8703` (PR #141); `src/frontend/src/pages/PredictionsDetails/PredictionsDetails.tsx` and its tests. |
| F1 Assistant | `POST /api/v1/chat` uses validated read-only tools, shared statistics loaders, Groq with Gemini fallback, and configurable rate limits. The frontend assistant widget provides follow-up conversation, safe links, retries, and a slow-response note. Conversation survives route navigation and clears on sign-out. | PRs #137 and #139; `src/backend/src/chat/`, `src/backend/src/routes/chat.routes.ts`, `src/frontend/src/components/chat/ChatWidget.tsx`, `src/frontend/src/App.chat.test.tsx`; [API Design](../api-design.md), [Third-Party Services](../third-party-services.md). |
| Submission and browsing UI | Final frontend updates expanded driver/race filters, polished submission history and admin pages, and added qualifying/prediction page tests. | `1df8703`, `eb647f6` (PR #141); `src/frontend/src/pages/Drivers/Drivers.tsx`, `src/frontend/src/pages/Races/Races.tsx`, submission/admin pages and related tests. |

## 3. API hardening and validation

PR #130 standardised authentication/error responses, returns client errors for malformed JSON and rejected CORS origins, and validates four-digit season values for driver/constructor statistics. The assistant work added tool, route, provider-fallback, formatting, and widget tests; these exercise controlled/mocked provider behaviour rather than proving live LLM response accuracy.

PR #138 (`44bcba6`) increased the frontend Vitest timeout for shared CI runners and adjusted frontend tests. PR #142 (`7aab2f4`) made frontend/backend coverage artifact uploads non-blocking with `continue-on-error: true`. Test/build jobs still fail when their required commands fail, and Railway deployment still depends on all four validation jobs.

Validation commands and results are in [Testing](../testing.md); environment and service prerequisites are in [Local Setup](../setup.md).

## 4. Technical notes

- The predictions page uses season aggregates as returned by the API; it does not restrict the inputs to races preceding the selected race. No model training, backtesting, confidence interval, or accuracy measurement is implemented in that page.
- PNG wireframes in `docs/wireframes/` are historical design artefacts.

## Sprint Meeting Summary

Sprint 4 meetings were centred on completing the remaining user-facing functionality and hardening the system for final delivery. The F1 Assistant was introduced with validated read-only tools, provider fallback and rate limiting, alongside a persistent conversation interface. Qualifying data was added across ingestion, database storage, API access and the frontend, and a fixed-weight prediction feature was introduced using qualifying and season statistics with its limitations explicitly documented. Race timelines, statistical charts, rankings and driver-season points were expanded to make the analytical side of the application richer. The final sprint also focused heavily on reliability, including consistent API errors, malformed-JSON and CORS handling, season validation, and CI improvements.
