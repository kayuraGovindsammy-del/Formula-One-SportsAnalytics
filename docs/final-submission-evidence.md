# Assessment Evidence

This index maps Milestone 1, 2, 3, and 4 rubric criteria to the project's
existing documentation and implementation evidence.

## Milestone 1 — Sprint 1

| Criterion | Evidence | Documentation |
|---|---|---|
| Version Control | Git-managed repository, branches, commits, and merged pull-request references. | [Git Workflow](git-workflow.md) |
| Documentation Site | MkDocs site structure and strict documentation build. | [Home](index.md), [Testing](testing.md), `mkdocs.yml` |
| Getting Started / Dev Guides | Local environment and setup instructions. | [Local Setup](setup.md) |
| Work Tracker | Taiga project activity screenshot supports the documented Scrum/project tracking, user stories, tasks, sprint work, ownership, and progress. | [Project Tracking Evidence — Taiga Work Tracking](methodology.md#taiga-work-tracking) |
| Git Methodology | Branch, commit, pull-request, review, and merge workflow with representative merged PR references. | [Git Workflow](git-workflow.md), [Sprint 2 Retrospective](retrospectives/sprint2-retrospective.md) |
| Project Methodology | Documented planning, validation, sprint review, and retrospective practices. | [Project Methodology](methodology.md), [Project Roadmap](project-roadmap.md) |
| Tech Stack | Runtime, frontend/backend, database, authentication, and documentation technologies. | [Repository Overview — Tech Stack](repo-overview.md#1-tech-stack) |
| Stakeholder Interaction | Sprint 2 stakeholder response and later external user feedback are recorded; Sprint 1-specific stakeholder feedback is not established by retained local evidence. | [Sprint 2 User Testing](user-testing/sprint2-user-testing.md#stakeholder-feedback-summary), [Sprint Evidence](sprint-evidence.md), [Retrospectives](retrospectives/sprint1-retrospective.md) |
| Initial Design & Dev Plan | Original wireframes, conceptual UML, and roadmap/evolution summary. | [Project Roadmap](project-roadmap.md), [UML Diagrams](uml-diagrams.md) |
| Implementation | Routed application and foundation work recorded in Sprint 1 evidence and current product documentation. | [Sprint 1 Retrospective](retrospectives/sprint1-retrospective.md), [User Guide](user-guide.md), [Repository Overview](repo-overview.md) |

## Milestone 2 — Sprint 2

| Criterion | Evidence | Documentation |
|---|---|---|
| Core Features | Core browsing, analytics, submission/review, API, data integration, and export capabilities with links to implementation details. | [Core Feature Coverage](user-guide.md#core-feature-coverage), [F1 Statistics](f1-statistics.md), [Authentication and Submission Workflow](auth-and-submission-workflow.md), [API Design](api-design.md), [Datasets](datasets.md), [Sprint 2 Retrospective](retrospectives/sprint2-retrospective.md) |
| Automated Testing | Backend coverage, Firestore rules, Playwright login checks, and CI expansion are documented. | [Testing](testing.md), [Sprint 2 Retrospective](retrospectives/sprint2-retrospective.md) |
| Stakeholder Reviews | One stakeholder response is separated from external-user ratings; retained meeting records establish occurrence/attendance, not discussion content. | [Sprint 2 Stakeholder Feedback](user-testing/sprint2-user-testing.md#stakeholder-feedback-summary), [Sprint Evidence](sprint-evidence.md) |
| API | Versioned route design and machine-readable endpoint contract. | [API Design](api-design.md), [OpenAPI](api/openapi.yaml) |
| User Feedback | Sprint 2 responses and documented header/search before/after evidence. | [Sprint 2 User Testing Evidence](user-testing/sprint2-user-testing.md) |
| Project Methodology | Sprint planning, work tracking, review, and retrospective process. | [Project Methodology](methodology.md), [Sprint 2 Retrospective](retrospectives/sprint2-retrospective.md) |
| Bug Tracker | Gitea issue screenshot shows open/closed issues, issue numbers, severity labels, and bug, testing, and implementation work. | [Project Tracking Evidence — Gitea Issue Tracking](methodology.md#gitea-issue-tracking), [Git Workflow](git-workflow.md), `.gitea/ISSUE_TEMPLATE/bug_report.md` |
| Database Documentation | Relational structure, event model, and PostgreSQL read-model information. | [Database Design](database-design.md), [Data Model](data-model.md) |
| Third-Party Code Documentation | Provider and dependency/licence information. | [Third-Party Services](third-party-services.md) |
| Testing Documentation | Test strategy, reported results, coverage, CI scope, and limitations. | [Testing](testing.md) |

## Milestone 3 — Sprint 3

| Criterion | Evidence | Documentation |
|---|---|---|
| User Feedback | Eight external Sprint 3 responses, numeric ratings, qualitative feedback, and screenshots. | [Sprint 3 User Testing Evidence](user-testing/sprint3-user-testing.md) |
| Automated Testing | Current backend, frontend, rules, Playwright, database, and documentation validation evidence. | [Testing](testing.md) |
| Feature Implementation | Sprint 3 analytics/exports and later qualifying/prediction/assistant additions are recorded with implementation references. | [Sprint 3 Delivery Evidence](retrospectives/sprint3-evidence.md), [Sprint 4 Delivery Evidence](retrospectives/sprint4-evidence.md) |
| API Implementation | Routes, API architecture, OpenAPI contract, and API hardening. | [API Design](api-design.md), [OpenAPI](api/openapi.yaml), [Sprint 4 Delivery Evidence](retrospectives/sprint4-evidence.md) |
| Performance | Constant-query tests and implementation safeguards; no load or latency benchmark is reported. | [Performance Evidence](testing.md#performance-evidence), [Sprint 3 Delivery Evidence](retrospectives/sprint3-evidence.md) |
| Improvement | Feedback is compared with later implementation while unresolved suggestions remain explicit. | [Sprint 2 Outcomes](user-testing/sprint2-user-testing.md#final-implementation-outcomes), [Sprint 3 Outcomes](user-testing/sprint3-user-testing.md#final-implementation-outcomes) |
| Documentation | Current architecture, testing, API, data, accessibility, and evidence documentation. | [Project Roadmap](project-roadmap.md), [Repository Overview](repo-overview.md), [Testing](testing.md) |
| Project Methodology | Work tracking, code review, CI, and retrospective evidence. | [Project Methodology](methodology.md), [Git Workflow](git-workflow.md), [Retrospectives](retrospectives/sprint1-retrospective.md) |

## Milestone 4 — Final Submission

## Database — 10%

| Criterion | Weight | Evidence |
|---|---:|---|
| Data | 3% | [Datasets](datasets.md), [Data Model](data-model.md), and [Data Ingestion](ingestion/jolpica-ingestion.md) describe production-source data, development samples, and test data. |
| Deployment | 2% | Aiven PostgreSQL is the production database in the documented Browser → Azure frontend → Railway API → Aiven PostgreSQL flow. |
| Structure | 5% | [Database Design](database-design.md), [Data Model](data-model.md), and [Event Schema](event-schema.md) document the relational design and event structure. |

## API — 25%

| Criterion | Weight | Evidence |
|---|---:|---|
| Availability | 3% | [API Design](api-design.md) and the [OpenAPI specification](api/openapi.yaml) document internal frontend use and external API access; the production base URL is [Railway](https://f1-sport-analytics-api-production.up.railway.app/api/v1). |
| Architecture | 5% | [API Design](api-design.md) documents the versioned Express API and route organization. |
| Deployment | 2% | The production API is hosted on Railway at [the production API base URL](https://f1-sport-analytics-api-production.up.railway.app/api/v1). |
| Performance | 5% | [Testing](testing.md#performance-evidence) records query-count tests, pagination, pooling, caching, and timeouts; no load-test or latency results are reported. |
| Design | 10% | [API Design](api-design.md) and the [OpenAPI specification](api/openapi.yaml) provide endpoint, method, versioning, and schema evidence. |

## Application — 42%

| Criterion | Weight | Evidence |
|---|---:|---|
| Accessibility | 5% | [Accessibility and Responsive Design](accessibility-responsive-design.md) documents semantic landmarks, form labels, ARIA use, focus styles, reduced motion, and the absence of a formal WCAG audit. |
| Aesthetics | 5% | [User Guide](user-guide.md) and [Sprint 3 User Testing Evidence](user-testing/sprint3-user-testing.md) provide interface guidance and before/after feedback evidence. |
| User Experience | 5% | [User Guide](user-guide.md), [Authentication and Submission Workflow](auth-and-submission-workflow.md), and the user-testing pages document primary workflows and feedback. |
| Deployment | 2% | The production frontend is hosted on [Azure](https://f1-sport-analytics-ede0h4cfb3augrhn.francecentral-01.azurewebsites.net/). |
| Performance | 5% | [Testing](testing.md#performance-evidence) describes frontend and backend safeguards and explicitly notes the lack of measured performance results. |
| Features | 10% | [User Guide](user-guide.md), [F1 Statistics](f1-statistics.md), [Datasets](datasets.md), and [Authentication and Submission Workflow](auth-and-submission-workflow.md) document core user-facing features. |
| Responsiveness | 5% | [Accessibility and Responsive Design](accessibility-responsive-design.md) documents CSS breakpoints and small-screen navigation behaviour. |
| Structure | 5% | [User Guide](user-guide.md) and the [documentation home](index.md) describe the application and its navigation. |

## Miscellaneous — 23%

| Criterion | Weight | Evidence |
|---|---:|---|
| Git Methodology | 5% | [Git Workflow](git-workflow.md) and [Project Methodology](methodology.md) describe branch, review, and collaboration practices; Sprint evidence provides delivery records. |
| Integration | 3% | [Third-Party Services](third-party-services.md), [Jolpica-F1 Pipeline](ingestion/jolpica-ingestion.md), and [OpenF1 Overtakes](ingestion/openf1-overtakes.md) document provider roles and integration paths. |
| Testing | 10% | [Testing](testing.md) records the current documented test results, coverage, CI gates, and known testing limits. |
| Tools | 5% | [Project Methodology](methodology.md), including [Project Tracking Evidence](methodology.md#project-tracking-evidence), [Git Workflow](git-workflow.md), and [Testing](testing.md) document project tracking, issue tracking, code review, CI, and development tools. |

## Production service flow

The production application flow is Browser → [Azure-hosted frontend](https://f1-sport-analytics-ede0h4cfb3augrhn.francecentral-01.azurewebsites.net/) →
[Railway Express API](https://f1-sport-analytics-api-production.up.railway.app/api/v1) → Aiven PostgreSQL.
Firebase Authentication and Firestore provide identity, profiles, and roles.
The production API base URL is
[`https://f1-sport-analytics-api-production.up.railway.app/api/v1`](https://f1-sport-analytics-api-production.up.railway.app/api/v1).

## Evidence for Later Reports

- **Methodology & Planning:** [Project Methodology](methodology.md) and
  [Project Roadmap](project-roadmap.md).
- **Architecture:** [Repository Overview](repo-overview.md),
  [UML Diagrams](uml-diagrams.md), [API Design](api-design.md), and
  [Database Design](database-design.md).
- **Testing:** [Testing](testing.md) and the Sprint 2/Sprint 3
  [user-testing evidence](user-testing/sprint2-user-testing.md).
- **Deployment & Integration:** [Repository Overview](repo-overview.md),
  [Third-Party Services](third-party-services.md), and
  [Data Ingestion](ingestion/jolpica-ingestion.md).
- **General Discussion / Project Evolution:** [Project Roadmap](project-roadmap.md)
  and the [Retrospectives](retrospectives/sprint1-retrospective.md).
