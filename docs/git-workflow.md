# Git Workflow for the Team

This project uses a simple Git workflow built around the default branch `main` and short-lived `feature/...` branches.

The repository also includes a Gitea CI pipeline in `.gitea/workflows/ci.yml`. It runs frontend lint/build checks, backend build and tests, and a strict MkDocs documentation build on pushes to `main` and pull requests targeting `main`.

The goal is to keep work organised, reviewable, and easy to merge for a five-person university project without overcomplicating the process.

## 1. Start from an issue

Before doing substantial work, create or be assigned a Gitea issue.

Use the issue to capture:
- the task or bug being addressed
- acceptance criteria
- any relevant notes, links, or files
- the owner of the work

If the work is not clearly defined in an issue, do not start building in a feature branch without clarifying it first.

## 2. Start from the latest main

Before creating a feature branch:

```bash
git checkout main
git pull --ff-only origin main
```

This keeps the branch starting point fresh and reduces merge conflicts.

## 3. Create a feature branch

Create a branch from the latest `main` using a clear, descriptive name.

Recommended naming:

```bash
git checkout -b feature/issue-short-description
```

Examples:
- `feature/readme-dev-setup`
- `feature/backend-race-endpoints`
- `feature/firebase-auth-guard`

Keep names short, specific, and consistent.

## 4. Do the work in the feature branch

Work should be focused and relevant to the issue.

Good practice:
- keep the branch scoped to one task or small group of related changes
- avoid unrelated refactoring
- commit in meaningful chunks
- do not directly edit `main`

## 5. Make focused commits

Make small, clear commits that reflect a coherent unit of work.

Example commit messages:
- `Add developer setup instructions`
- `Implement driver list API route`
- `Fix validation for invalid race query params`

Good commit messages should:
- describe what changed
- be written in the present tense
- be specific enough to understand the purpose without reading the full diff

Avoid vague messages such as:
- `updates`
- `fix stuff`
- `misc changes`

## 6. Push the feature branch

Once the work is ready for review:

```bash
git push -u origin feature/issue-short-description
```

The branch should be pushed before opening the Pull Request.

## 7. Open a Pull Request into main

Open a Pull Request from the feature branch into `main`.

The Pull Request should include:
- a short summary of the work
- what was changed
- any relevant testing notes
- the issue being addressed

Where possible, link the Pull Request to the relevant Gitea issue.

## 8. Review the Pull Request

At least one other team member should review the Pull Request before merging.

Reviewers should check:
- correctness of the implementation
- whether it matches the issue requirements
- whether tests or validation were run
- whether the change is appropriately scoped
- whether the code is readable and maintainable

## 9. Resolve issues before merging

If review comments are requested, fix them in the same feature branch and push the updates.

Do not merge a Pull Request that still has unresolved blocking feedback unless the team explicitly agrees otherwise.

## 10. Merge into main

Only after review and approval should the branch be merged into `main`.

This should be done as a normal Pull Request merge rather than direct commits to `main`.

## 11. Avoid direct work on main

Feature work should never be developed directly on `main`.

This keeps:
- the main branch stable
- review and approval explicit
- team changes easier to track
- merge conflicts easier to manage

## 12. Clean up completed branches

After a feature branch has been merged and is no longer needed, delete it where appropriate.

This reduces clutter and keeps the repository easier to follow.

## 13. Pull request expectations

A good Pull Request should be:
- small enough to review carefully
- clearly titled and explained
- linked to the relevant issue where possible
- reviewed by another team member before merge
- merged only when the work is complete and agreed upon

## 14. Team expectation

For this group project, we are aiming for a lightweight but disciplined workflow.

The process is:

```text
Gitea issue -> feature branch from main -> implementation/testing -> commit -> push -> pull request -> code review -> merge into main
```

This is the expected default workflow for the project.
