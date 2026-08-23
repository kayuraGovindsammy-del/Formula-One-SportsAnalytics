# Project Methodology

This project uses a lightweight Agile/Scrum-style methodology suited to a five-person university team working across frontend development, backend API work, Firebase authentication, PostgreSQL data flows, and data-analysis features. The goal is to keep delivery organised, collaborative, and transparent without introducing unnecessary overhead.

The team’s development process is built around a small number of practical habits: clear task definition, branch-based delivery from `main`, peer review, automated validation, and regular Sprint check-ins. This gives the project enough structure to stay coordinated while remaining focused on implementation and delivery.

## 1. Core workflow

The project uses a simple and consistent workflow:

1. define the work in a Gitea issue
2. pull the latest `main`
3. create a `feature/...` branch from `main`
4. implement the work in a focused branch
5. run the relevant validation checks
6. push the branch and open a Pull Request
7. complete peer review before merge
8. merge approved work into `main`

This is the default delivery model for the project. The team keeps work organised through Git branches, Gitea Issues, and Pull Requests rather than through a heavier process or a separate development branch.

## 2. Sprint planning and backlog

The team uses short delivery cycles to keep the project moving steadily and to maintain clarity around priorities. Sprint planning is used to identify the most important work for the upcoming cycle, break it into manageable tasks, and assign ownership where practical.

The Sprint backlog is managed through the project’s issue tracking and branch-based implementation work. Gitea provides the central work-tracking mechanism for tasks, bug fixes, and feature delivery. Each item should describe a clear goal, expected outcome, and any relevant technical notes so the team can move from planning to implementation without confusion.

This project is not large enough to justify a heavy formal process, but it does benefit from a visible backlog, clear ownership, and a regular review of progress. That makes planning practical and keeps the team aligned on what is being delivered next.

## 3. Gitea Issues and traceability

Gitea Issues are the primary mechanism for creating and tracking work. They are used to record the task, clarify expectations, and provide a reference point throughout implementation.

A well-formed issue should include:

- the task or problem being addressed
- the expected outcome or acceptance criteria
- any technical context, references, or relevant files
- the owner or team member responsible for the work

This makes the project traceable from issue to branch to implementation to review to merge. It also helps the team maintain continuity when work is shared across frontend, backend, database, Firebase, and analytics tasks.

## 4. Feature branches and focused delivery

The team works in short-lived `feature/...` branches created from `main`. This keeps work isolated, reviewable, and easier to merge without disturbing the main branch.

Each feature branch is intended to be focused on a specific problem or deliverable. Team members keep changes scoped to the agreed task and avoid mixing unrelated refactoring or exploratory work into the same branch. This approach is especially useful for a project that spans multiple technical areas and where several members may be working concurrently.

## 5. Meaningful commits

The team uses meaningful, readable commits to maintain a clear history of work. Commit messages are expected to describe the purpose of the change rather than generic status updates.

This supports maintainability and makes it easier for teammates to review the project history. It also helps when debugging issues or reviewing a feature after the fact.

## 6. Pull Requests and peer review

Pull Requests are the key integration step for work moving from a feature branch into `main`. The team uses them to review scope, verify correctness, and confirm that a change is appropriate before it is merged.

Peer review is a standard part of the process. Reviewers check whether:

- the implementation matches the agreed task
- the change is appropriately scoped
- the logic is sound
- validation has been run
- the code remains understandable and maintainable

This keeps quality high while supporting a collaborative development environment. For a five-person project, this is a practical balance between speed and technical oversight.

## 7. Automated validation and testing

The frontend and backend projects both include automated validation scripts. The frontend includes linting and build checks, and the backend includes TypeScript build validation and Vitest test execution.

These checks are part of the team’s expected workflow for validating implementation work before merge. In practice, they help catch issues early and give reviewers clear evidence that a change has been exercised in the relevant project layer.

The team uses automated validation as a normal part of delivery rather than as an optional extra. This is particularly important for a project with both UI work and backend/data work, where a change in one area can have knock-on effects in another.

## 8. CI and automated project checks

The project includes the necessary frontend and backend validation tooling, and CI will automatically verify the relevant checks as the team integrates the repository automation for Sprint 1. This is an important part of the project’s development discipline and supports consistent quality standards across changes.

CI is intended to provide a repeatable check for project health, especially for pull requests and branch-based delivery. The team uses automated checks to reduce manual review overhead while maintaining confidence in the code that is merging into `main`.

## 9. Stakeholder interaction and requirement flow

The project is not built in isolation. Tutor or stakeholder feedback is treated as a source of project direction and requirement clarification. When feedback is received, it is translated into concrete technical decisions, backlog items, or issue updates so that the team can act on it consistently.

This makes stakeholder input part of the delivery process rather than an isolated conversation. In practice, this means requirements can evolve as the project develops, and changes are captured in the same issue and backlog workflow used for all technical work.

## 10. Sprint review and retrospective

Sprint reviews are used to check progress against the planned work, identify what was completed, and confirm the team’s priorities for the next cycle. The project team reviews what was achieved, what changed, and whether any work needs to be adjusted based on new information or technical constraints.

Retrospectives are used to reflect on what went well, what caused friction, and what should improve in the next Sprint. This is particularly useful in a project with multiple workstreams, where communication, task ownership, and integration work are just as important as the code itself.

The goal is not to create bureaucracy, but to keep the team aligned and to improve the process over time as the project matures.

## 11. Evidence and traceability

The methodology is demonstrated through the project’s normal development artefacts:

- Gitea Issues
- Sprint milestones and project tracking
- feature branches
- meaningful commits
- Pull Requests
- peer review
- CI results
- test results
- meeting and stakeholder notes
- Sprint review and retrospective records

These are the artefacts that make the team’s process visible and maintainable. They provide traceability from planning through implementation and review, which is essential for a collaborative project with several concurrent workstreams.

## 12. Summary

This project uses a practical, lightweight Agile/Scrum-style process designed for a small university team. The team works from `main` using `feature/...` branches, keeps work visible in Gitea Issues, reviews changes through Pull Requests, validates with automated checks, and reviews progress through Sprint activities.

This methodology is intentionally lightweight: it provides structure without formal overhead, supports rapid iteration, and matches the realities of building a Formula 1 sport analytics application across frontend, backend, Firebase, and data workflows. It is a realistic and appropriate model for this project and its team size.
