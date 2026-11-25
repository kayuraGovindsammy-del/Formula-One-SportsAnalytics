# Project Roadmap and Evolution

## Original Project Direction

The project began as a Formula 1 analytics platform for browsing statistics and
race information, deriving analytics from event data where available, allowing
approved users to contribute data for review, and making data available through
an API and downloadable datasets. Later features were added as the system and
its requirements evolved; the final Sprint 4 feature set should not be read as
the original plan.

## Initial System Design

The initial direction separated a routed web frontend from a hand-written
backend API and a relational data store. Firebase Authentication and roles
supported identity and controlled contribution workflows, while event and
relational data supported browsing and statistics.

- [UML Diagrams](uml-diagrams.md) show the conceptual use-case and
  authentication/submission flows.
- [Repository Overview](repo-overview.md) describes the current system
  boundaries and how the implementation evolved.
- [Data Model](data-model.md) documents the relational and event-data model.
- [API Design](api-design.md) documents the backend API and its public
  contract.

## Initial UI Design

The following are original, low-fidelity design artefacts from
`docs/wireframes/`. They illustrate proposed screens and workflows, not a
pixel-perfect specification or proof that every wireframed element was
implemented. Labels and example values shown in the images are conceptual.

### Original platform wireframes

![Original wireframes for sign-in, dashboard, browsing, statistics, submission, and administration](wireframes/Wireframe%201.png)

*Original design showing sign-in, dashboard, driver/constructor/race/statistics
pages, data submission, submitter requests, and submission review.*

### Original dashboard and core workflow wireframes

![Original wireframes for dashboard, browsing, statistics, submission, and review](wireframes/Wireframe%202.png)

*Original design showing dashboard and data-browsing pages alongside the
approved-submitter form and administrator review workflow.*

## Sprint 1 — Foundation

### Main objective

Establish the technical and project foundation for a full-stack Formula 1
analytics platform.

### Major additions

- Routed pages for drivers, races, constructors, and statistics.
- Firebase authentication and role-controlled submitter and administrator
  interfaces.
- Initial Express API and application health/error handling.
- Relational and event-data foundations with an initial Belgian Grand Prix
  sample dataset.
- Git/Scrum workflow, MkDocs documentation structure, and initial CI.

### Testing/quality focus

The sprint established the repository workflow, initial frontend/backend
validation, and documentation build process. Sprint 1 retrospective evidence
identifies integration, sample-data quality, and evidence capture as areas to
strengthen in later work.

### Outcome

The project moved from an initial concept to a functional full-stack
foundation. See the [Sprint 1 retrospective](retrospectives/sprint1-retrospective.md),
[User Guide](user-guide.md), and [Repository Overview](repo-overview.md).

## Sprint 2 — Core Product

### Objective

Move beyond the initial prototype and support more realistic data and
contribution workflows.

### Major additions

- Jolpica ingestion, caching, and PostgreSQL read models.
- Stronger submission review/history and role rules, with recoverable
  account-deletion behaviour.
- Expanded statistics, including points, consistency, grid-gain, and
  classification fallbacks.
- External user testing and evidence of feedback-driven navigation and search
  changes.

### Quality focus

Backend coverage, Firestore rules testing, Playwright login checks, API
documentation, and CI were expanded. Testing remained narrower than complete
authenticated end-to-end coverage. See [Testing](testing.md) and the
[Sprint 2 retrospective](retrospectives/sprint2-retrospective.md).

### Outcome

The application gained database-backed Formula 1 data and more complete
submission and browsing workflows. Recorded user feedback and its documented
implementation context are in [Sprint 2 User Testing Evidence](user-testing/sprint2-user-testing.md).

## Sprint 3 — Analytics and Reliability

### Objective

Strengthen the analytics layer and improve reliability across the integrated
system.

### Major additions

- Database-backed constructor standings and published points, including
  per-race team attribution.
- Driver-season statistics redesigned around a constant-query approach.
- OpenF1 position-change/overtake ingestion and expanded authentication tests.
- CSV and JSON exports, wider frontend coverage, fresh-database validation,
  and database integration testing.
- Sprint 3 external user testing and continued deployment/reliability work.

### Quality focus

Characterization and query-count tests, expanded frontend/backend checks, and
integration validation addressed correctness and query growth. The
[Sprint 3 delivery evidence](retrospectives/sprint3-evidence.md) and
[Sprint 3 User Testing Evidence](user-testing/sprint3-user-testing.md) record
implementation and user feedback separately.

### Outcome

The product moved toward reusable, data-backed analytics and improved
validation. Feedback remained useful for identifying targeted improvements
rather than requiring every suggestion to be implemented.

## Sprint 4 — Final Product

### Objective

Complete the remaining user-facing analytics and prepare the integrated
application and documentation for final delivery.

### Major additions

- Qualifying ingestion, API access, and dedicated qualifying views.
- Race predictions based on qualifying and season statistics.
- The read-only F1 Assistant, richer race timelines, charts, and statistics.
- API hardening, expanded targeted validation, and production deployment
  documentation.

### Quality focus

API error handling, validation, frontend tests, documentation, and gated
deployment checks were strengthened. The prediction view is an estimate; the
repository does not record model training, backtesting, or measured predictive
accuracy. See [Sprint 4 Delivery Evidence](retrospectives/sprint4-evidence.md)
and [Testing](testing.md).

### Outcome

The final platform combines browsing, analytics, qualifying, predictions,
exports, contribution workflows, and a read-only assistant. The implementation
and its limitations are described in the [User Guide](user-guide.md) and
[Repository Overview](repo-overview.md).

## How the Roadmap Evolved

- Early integration and data-quality limitations led to more realistic
  ingestion/read models, statistics fallbacks, and expanded integration
  testing; these issues and follow-up work are recorded in the
  [Sprint 1](retrospectives/sprint1-retrospective.md) and
  [Sprint 2](retrospectives/sprint2-retrospective.md) retrospectives.
- Sprint 2 user responses preceded documented navigation/header and search
  affordance changes; the [user-testing page](user-testing/sprint2-user-testing.md)
  records the feedback, before/after screenshots, and implementation
  traceability.
- Two Sprint 3 respondents requested qualifying information. Qualifying
  ingestion, API support, and UI views appear in the later
  [Sprint 4 delivery evidence](retrospectives/sprint4-evidence.md). This
  chronology supports a later implementation, but does not by itself prove
  that the requests were the sole cause.
- Statistics grew as data coverage and published-result fallbacks improved.
  Data limitations and fallback rules are documented in
  [F1 Statistics](f1-statistics.md).
- Testing and CI expanded across the sprints, from initial validation to
  disposable PostgreSQL checks, Firestore rules tests, Playwright smoke tests,
  and strict documentation builds. Current scope and limits are in
  [Testing](testing.md).
- Deployment and reliability needs led to gated Railway API deployment and a
  separately documented Azure frontend. The current service flow and its
  evidence are summarized in the [Repository Overview](repo-overview.md).

## Final State

The production platform is documented as an Azure-hosted frontend using a
Railway Express API and Aiven PostgreSQL, with Firebase Authentication and
Firestore for identity, profiles, and roles. Jolpica and OpenF1 provide
Formula 1 data inputs. See the [documentation home](index.md) for the
application URL and [Third-Party Services](third-party-services.md) for
provider roles.

## Future Improvements

Remaining opportunities already identified in the documentation include:

- Broader historical-season selection; the current interface does not provide
  a general season picker.
- Wider authenticated end-to-end testing beyond the current login smoke suite.
- Measured frontend/API performance and formal accessibility evaluation;
  current documentation records implementation safeguards, not benchmark or
  compliance results.
- Follow-up evaluation of unresolved user requests, including submission
  status clarity and optional visual enhancements.

See [Repository Overview](repo-overview.md), [Testing](testing.md), and the
Sprint 2 and Sprint 3 user-testing pages for the recorded limitations and
feedback.
