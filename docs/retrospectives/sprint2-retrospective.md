# Sprint 2 Retrospective

## Sprint Overview

Sprint 2 ended around 15 September 2026. The repository records work across frontend presentation, PostgreSQL and ingestion, derived statistics, API documentation, testing, and project process. This is a team-wide retrospective based on Git history and the [Sprint 2 user testing evidence](../user-testing/sprint2-user-testing.md). It does not reconstruct meeting discussion.

## Sprint Meeting Summary

Sprint 2 meetings concentrated on moving beyond the initial prototype and making the application work with more realistic data and workflows. Jolpica ingestion, caching and PostgreSQL read models were introduced so that Formula 1 information could be sourced and queried more reliably. The team also strengthened the submission review and history process, role rules and recoverable account-deletion behaviour, while expanding the statistics available to users, including points, consistency, grid-gain and race-result fallbacks. User testing became an important part of the sprint, and the interface was adjusted in response to the feedback collected. Testing also matured substantially through increased backend coverage, Firestore rules testing, Playwright login checks and CI integration.

## What Went Well

- The team integrated database and analytics work through PRs #51 and #52, then expanded statistics behavior with points, lap consistency, qualifying-grid comparisons, and result-status fixes through PRs #57, #59, #63, #66, and #69.
- The ingestion work brought Jolpica data and an OpenAPI reference into the repository (PRs #50 and #77). The API reference became accessible through Swagger UI, with a subsequent path-handling fix (PR #79).
- Frontend feedback led to visible navigation and search changes. Commit `632fbad` and PR #70 follow the dated external-user responses, and the [before/after screenshots](../user-testing/sprint2-user-testing.md#before-and-after-evidence) support those specific changes.
- Testing documentation, backend coverage, CI validation, Playwright checks, and process infrastructure were added or improved through PRs #71–#74 and #76. These are Sprint 2 changes; their exact current scope is described in [Testing](../testing.md).

## What Did Not Go Well

- Fixes to race and driver statistics, result status, Playwright login routing, and OpenAPI path handling show that cross-layer integration exposed gaps after initial implementation. The corresponding fix PRs are #66, #69, #76, and #79.
- The sample-data and qualifying coverage remained limited, so some statistics could not be populated reliably for all drivers and races.
- The stakeholder found the contribution workflow unclear after a submitter-access request. The Sprint 2 feedback record does not establish that this concern was fully resolved.
- Repository evidence alone does not establish that every Taiga task, review decision, or meeting action was retained. Meeting screenshots establish occurrence and attendance, without discussion minutes.

## User and Stakeholder Feedback

Six external users and one stakeholder responded between 11 and 13 September. External users rated navigation and appearance 4.83/5 on average; finding drivers and races scored 4.67/5. Suggestions included a clearer search icon, header styling, team grouping, predicted race times, and China track-map contrast. The navigation and search changes have repository and screenshot evidence. Team grouping, predictions, and map contrast are not claimed as completed here.

The stakeholder praised visual polish and driver search, and asked for clearer communication of pending submitter-access status and next steps. This remains an explicitly tracked improvement opportunity until implementation and follow-up feedback are documented. No Sprint 3 feedback is inferred from Sprint 2 responses.

## Testing and Quality

Sprint 2 added backend coverage reporting and broadened CI, with Firestore rules and a narrow Playwright login smoke suite. The test record also shows statistics regression work, including recalculation tests (PR #54). The five Playwright checks cover the unauthenticated login page; they do not prove authenticated analytics or contribution journeys. Current coverage numbers and Sprint 3 CI follow-up status are recorded in [Testing](../testing.md).

## Process and Methodology

The Git history shows work delivered on branches and merged through named pull requests across several workstreams. Gitea CI configuration and the bug-report template are repository evidence of validation and issue-tracking support. Taiga planning and Teams meetings are described by the team, but this repository does not contain a full Taiga export, PR approval archive, or meeting transcripts. The [Sprint Evidence](../sprint-evidence.md) page limits meeting claims to externally retained screenshots.

## Lessons Learned

- Integrate and test statistics against realistic results and incomplete telemetry early.
- Check documentation contracts against mounted routes after implementation changes.
- Tie feedback to a specific change and retain before/after evidence; keep unresolved requests visible.
- Retain review, planning, and meeting evidence during the sprint so methodology claims can be checked later.

## Actions Carried Into Sprint 3

- PostgreSQL submission integration CI setup and frontend Vitest/V8 coverage CI were merged in Sprint 3 through PR #116. Backend CI now supplies its own disposable database and `TEST_DATABASE_URL`; retain hosted run evidence to confirm execution. Expanding authenticated end-to-end tests remains a follow-up.
- Clarify submitter request status and next steps, then seek follow-up user feedback.
- Reconcile API, database, setup, security, and testing pages with the current implementation.
- Preserve Sprint 3 meeting and user-feedback evidence without inventing discussion content.
- Verify active deployment hosts and record external Taiga/Gitea review evidence for assessment.
