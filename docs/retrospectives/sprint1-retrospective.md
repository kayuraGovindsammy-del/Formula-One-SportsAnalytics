# Sprint 1 Retrospective

This retrospective is based on the repository’s Sprint 1 evidence and Git history. It is intentionally limited to work that can be supported by the project record, and it excludes later Sprint 2 items such as the Playwright login-route fix, the Sprint 2 user-testing evidence page, and the later coverage/CI expansion that was added after Sprint 1. The project context records a Sprint 1 score of 95%, but that result is not proved by repository history and is included here only as background context for the team’s overall outcome.

## 1. What went well

Sprint 1 established a strong foundation for the whole project. The team moved quickly from initial setup into working frontend, backend/API, data, analytics, documentation, and CI workstreams. That parallel momentum was one of the clearest strengths of the sprint.

### Frontend workstream

The frontend workstream built the application structure early and made the project visible to the team and stakeholders. The Git history shows a clear progression from initial scaffolding to concrete user-facing pages: `ed6656f` (“Set up frontend”), `63753f7` (“Set up frontend structure and page routing”), `14b5516` (“Implement 2025 drivers page with filtering”), and `3255642` (“Implement race and driver details”). These were followed by merged PRs `#3` (`feature/frontend-setup`), `#8` (“Wire frontend Drivers/Races pages to real sample data”), and `#23` (“Add constructors and statistics frontend pages”).

That foundation mattered because it gave the project usable application structure, routing, and core pages for drivers, races, constructors, and statistics. The frontend workstream did not just create a shell; it established the project’s main user-facing surface area early in Sprint 1.

### Backend/API workstream

The backend/API workstream also gave Sprint 1 a strong technical base. The repository records the setup of the Express backend with health and error handling (`c8c84b9`), followed by read endpoints for drivers, races, laps, and events (`c52baac`), and then a derivation engine and derived statistics endpoints (`3d05dde`). This work was supported by the API design and contract documentation in [docs/api-design.md](../api-design.md), [docs/data-model.md](../data-model.md), [docs/event-schema.md](../event-schema.md), and [docs/f1-statistics.md](../f1-statistics.md).

The backend workstream therefore delivered more than just server scaffolding. It established the project’s API contracts, data retrieval layers, and derived-statistics approach, all of which were central to the project’s overall technical direction.

### Data, schema, and sample-data workstream

Sprint 1 also included important data work that supported the rest of the project. The repository shows early design and sample-data work through `1da91b3`/`7f91fd9` (“Add F1 data model, event schema, and statistics catalogue docs”) and `ab6f0be` (“Add sample F1 dataset”). Together with the schema and seed files in `database/schema.sql` and `database/seed.sql`, and the related documentation, this indicates that the team treated data design as a separate Sprint 1 workstream rather than only as a backend or frontend concern.

That matters because the project depended on consistent sample data, event schema decisions, and data-model clarity to support both analytics and UI development.

### Analytics/statistics workstream

The statistics and analytics workstream was central to the project’s purpose. Sprint 1 includes the derivation engine, derived statistics endpoints, and the statistics catalogue/documentation that explain the expected formulas and data assumptions. The repository evidence in [docs/f1-statistics.md](../f1-statistics.md), along with the backend analytics commits, shows that the team was already focusing on data meaning, not just on rendering pages.

This is a major Sprint 1 strength: the project did not stop at CRUD-like scaffolding. It established the analytical logic that would later support driver, race, and constructor insight.

### Project process, documentation, and CI workstream

The project also invested early in process and documentation. The repo records methodology and Git workflow work (`dba207d`, `2d54e97`), MkDocs setup (`2e3e7dd`), developer setup improvements (`611ae23`), and CI foundations (`b8fd504`). These are supported by [docs/methodology.md](../methodology.md), [docs/git-workflow.md](../git-workflow.md), `README.md`, `mkdocs.yml`, and `.gitea/workflows/ci.yml`.

This work should be recognised as part of Sprint 1’s success, but not as the whole story. The project’s real strength was that the team built technical foundations, process foundations, and documentation foundations together.

### Team coordination and delivery discipline

Sprint 1 also demonstrated healthy parallel work. Multiple workstreams were developed on feature branches and merged through Pull Requests, which gave the project a disciplined but flexible delivery rhythm. The repository history shows a consistent pattern of short-lived branches feeding into `main`, supported by Taiga planning and Gitea review/merge traceability as described in [docs/methodology.md](../methodology.md) and [docs/git-workflow.md](../git-workflow.md).

That combination helped the team manage concurrency without losing track of what was happening across frontend, backend, data, analytics, and documentation.

## 2. Friction / what did not work

Sprint 1 was not friction-free, and the repository records several project-level issues that are worth acknowledging.

### Frontend integration and validation issues

The frontend workstream hit integration problems that were later corrected. The corrective commit `0f535a5` (“Fix frontend lint and build errors”) and its merge through PR `#31` are clear evidence that early validation surfaced real problems. This was a normal but meaningful source of friction during Sprint 1.

### Backend test and statistics integration issues

The backend/API workstream also experienced issues where automated tests exposed real integration or configuration problems. The corrective work in `9da7cf9` (“Fix backend test initialization and race statistics”), merged through PR `#32`, is strong evidence that the team was learning how quickly test failures could reveal underlying issues in the backend and statistics path.

### Data and sample-data limitations

Sprint 1 also showed that the data layer still had limits. The repository records the data model and sample-data work, but it also shows that analytics and statistics were being built against a constrained sample dataset and that some gaps remained in the project’s data story. This should be treated as a valid Sprint 1 constraint rather than a failure of the team.

### Environment and setup assumptions

The project later improved setup documentation, and the September 8 repository overview recorded that setup assumptions were not always completely clear. The historical Node.js engine mismatch (`engines: >=22` at the root while CI ran Node 20) is one example. This was a genuine friction point in Sprint 1: local setup expectations needed to be more explicit. Current CI uses Node 22; the mismatch is retained here as historical evidence rather than a current setup issue.

### Documentation quality and validation

The docs site was created early, but the history shows that documentation quality also needed tightening. The broken-link fix (`bdc8a99`) provides good evidence that docs had to be validated rather than merely written. This was not a team failure; it was a useful reminder that project documentation is part of the build and quality story.

### Deployment verification and evidence gaps

The historical repository overview also shows that deployment assumptions were not always fully verifiable from repository configuration alone. The Azure deployment workflow in `workflows/deploy-azure.yml` is outside the Gitea workflow directory. This matters because it shows that deployment status needed to be verified rather than assumed. Later Railway deployment automation is Sprint 3 evidence and is not attributed to Sprint 1 here.

### Testing depth was still maturing

Sprint 1 established useful automated checks, including backend tests, frontend lint/build validation, and documentation validation, but behavioural and cross-workstream testing was still maturing. The later expansion into broader frontend, rules, coverage, and end-to-end testing in Sprint 2 reflects that gap. This was a realistic Sprint 1 limitation, not a sign that the sprint failed.

## 3. Lessons learned

The Sprint 1 lessons were mostly about how the project needed to mature as a system, not about any single team member or workstream failing.

1. Frontend, backend/API, and data layers need clear contracts. The project benefited when API and data decisions were documented early, as seen in [docs/api-design.md](../api-design.md), [docs/data-model.md](../data-model.md), and [docs/event-schema.md](../event-schema.md).
2. Derived statistics need reliable data and strong validation. The analytics workstream shows that statistical logic was central to the project, but it also needed consistent sample data and test coverage to remain trustworthy.
3. Automated validation should start early and continue throughout the sprint. Sprint 1 showed that both frontend and backend validation could catch real issues before they became harder to fix.
4. Documentation should evolve alongside implementation. The project’s documentation and MkDocs setup proved their value, but the broken-link cleanup showed that docs must also be checked for quality.
5. Environment requirements must be explicit. The project later improved setup guidance, which is evidence that environment clarity was a real learning point.
6. Deployment should be verified rather than assumed. The repository overview makes that point clearly.
7. Short-lived branches and Pull Requests helped the team coordinate parallel work. This is one of the strongest process lessons from Sprint 1.
8. Evidence should be captured while the sprint is happening. The later Sprint 2 process documentation and testing evidence are a clear example of the project learning to preserve evidence more deliberately.

## 4. What we should repeat in Sprint 2

The following Sprint 1 practices are worth continuing:

- short-lived feature branches from `main`
- Pull Requests into `main` with review before merge
- Taiga for planning and work tracking, with Gitea for code review and repository traceability
- continuing MkDocs documentation and strict docs validation
- keeping frontend/backend build and test checks as a normal delivery step
- maintaining clear workstream ownership across frontend, backend/API, data, analytics, and process/docs work
- continuing to improve developer setup and onboarding documentation
- preserving regular integration between workstreams rather than allowing large late merges

## 5. What we should change in Sprint 2

Sprint 2 should build directly on Sprint 1’s lessons:

- increase automated test coverage across frontend behaviour, API/service validation, and statistics logic
- improve sample-data quality and make cross-workstream data assumptions more visible
- strengthen integration testing between frontend, API, and data layers
- improve bug tracking so issues are recorded while they are still fresh
- verify public deployments rather than relying on configuration alone
- capture tutor and stakeholder feedback systematically, with clear traceability from feedback to implementation decisions
- run external-user testing as a separate process to preserve user feedback evidence
- maintain clearer sprint check-ins so blockers, decisions, and ownership remain visible throughout the sprint
- improve setup and environment clarity so local onboarding friction is reduced

## 6. Action items and owners

| Action | Owner / Workstream | Sprint 2 purpose |
|---|---|---|
| Expand frontend behaviour testing | Frontend workstream + Testing/CI/process workstream | Improve confidence in the main user-facing flows |
| Improve API/service validation | Backend/API workstream | Catch route, error, and integration issues earlier |
| Improve sample-data coverage and quality | Database/data workstream + Analytics/statistics workstream | Strengthen the foundations for analytics and UI consistency |
| Strengthen derived-statistics validation | Analytics/statistics workstream | Reduce ambiguity and improve trust in complex logic |
| Keep CI and coverage reporting current | Testing/CI/process workstream | Maintain useful automated quality gates |
| Verify public deployments | Relevant deployment owners + Testing/CI/process support | Replace assumptions with evidence |
| Capture tutor/stakeholder feedback | Whole team | Make review input traceable and actionable |
| Run external-user testing | Frontend / User Feedback workstream, with testing/process documentation support | Preserve separate user-feedback evidence |
| Maintain sprint evidence and check-ins | Whole team | Keep progress, blockers, and decisions visible |
| Keep developer setup and docs current | Whole team, coordinated by docs/process workstream | Reduce onboarding and setup friction |

## 7. Supporting evidence

Representative repository evidence for this retrospective includes:

- `ed6656f` — Set up frontend (PR `#3`)
- `63753f7` — Set up frontend structure and page routing
- `14b5516` — Implement 2025 drivers page with filtering
- `3255642` — Implement race and driver details
- `c8c84b9` — Set up Express backend with health endpoint and error handling
- `c52baac` — Add API read endpoints for drivers, races, laps and events (PR `#19`)
- `3d05dde` — Add derivation engine and derived statistics endpoints (issue `#16`, merged in PR `#21`)
- `1da91b3` / `7f91fd9` — Add F1 data model, event schema, and statistics catalogue docs
- `ab6f0be` — Add sample F1 dataset
- `dba207d` — Document team Git workflow
- `2d54e97` — Document project methodology
- `2e3e7dd` — Add MkDocs documentation site
- `611ae23` — Improve developer setup documentation
- `b8fd504` — Add CI workflow
- `0f535a5` — Fix frontend lint and build errors (PR `#31`)
- `9da7cf9` — Fix backend test initialization and race statistics (PR `#32`)
- `bdc8a99` — Fix broken documentation links
- [docs/methodology.md](../methodology.md), [docs/git-workflow.md](../git-workflow.md), [docs/testing.md](../testing.md), [docs/repo-overview.md](../repo-overview.md), `README.md`, `mkdocs.yml`, and `.gitea/workflows/ci.yml`

## 8. Scope note

This retrospective is explicitly about Sprint 1. It does not treat later Sprint 2 work as if it already existed during Sprint 1, including the Playwright login-route fix, the Sprint 2 user-testing evidence page, the later coverage/CI expansion, and the authentication/submission enhancements in `14a1f84`. Initial Firebase authentication, role guards, and submission pages were already introduced in Sprint 1 (`857fe15`, PR #9); Sprint 2 extended that foundation. The supporting commit references above are reachable from the current `main` history. Where chronology is uncertain, the wording above remains conservative and evidence-based.
