# Formula 1 Sport Analytics

This project is a Formula 1 sport analytics platform built for the course team. It combines a React frontend, a hand-written Express API, Firebase Authentication for identity and access control, and a PostgreSQL-backed data model for the team’s Formula 1 application data.

The application is designed to let users explore drivers, races, statistics, and event data, while approved submitters and administrators can contribute race-related data for review.

The current frontend also includes qualifying results, analytical race predictions,
driver comparisons and charts, a filtered race timeline, CSV/JSON dataset downloads,
and a floating F1 Assistant. Predictions use qualifying and whole-season statistics;
they are estimates rather than official results. Authentication supports Google and
email/password sign-in, registration and password reset.

## Key Features

- Browse drivers, constructors and races.
- Explore race, season and driver statistics with rankings and visualisations.
- View qualifying results and qualifying-specific pages.
- See race predictions based on qualifying and season statistics.
- Use the F1 Assistant for read-only Formula 1 queries.
- Explore interactive race timelines, charts and statistical views.
- Download and export datasets in CSV and JSON.
- Sign in with Firebase Authentication and role-based access.
- Submit data and use review, publication and history workflows.
- Ingest Formula 1 data from Jolpica and OpenF1.

## Main documentation

Use the navigation to explore the project documentation:

- Project Methodology and Sprint working approach
- Git Workflow and delivery process
- Technical architecture, API design, and data model documentation
- public documentation site and deployment notes
- [Local Setup](setup.md), [User Guide](user-guide.md) and [Testing Overview](testing.md)
- [Repo Overview](repo-overview.md) for the current stack, source layout and implementation limits

The team uses Taiga for Sprint planning and backlog tracking, while Gitea is used for repository management, feature branches, Pull Requests, and review. The public documentation for the project is available at: https://eagle-stack-documentation.netlify.app/

> The project’s identity and authentication layer is handled by Firebase Authentication. The application’s Formula 1 data is accessed through the project’s custom Express API rather than Firebase-generated endpoints.
