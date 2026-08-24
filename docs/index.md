# Formula 1 Sport Analytics

This project is a Formula 1 sport analytics platform built for the course team. It combines a React frontend, a hand-written Express API, Firebase Authentication for identity and access control, and a PostgreSQL-backed data model for the team’s Formula 1 application data.

The application is designed to let users explore drivers, races, statistics, and event data, while approved submitters and administrators can contribute race-related data for review.

## Main documentation

Use the navigation to explore the project documentation:

- Project Methodology and Sprint working approach
- Git Workflow and delivery process
- Technical architecture, API design, and data model documentation
- public documentation site and deployment notes

The team uses Taiga for Sprint planning and backlog tracking, while Gitea is used for repository management, feature branches, Pull Requests, and review. The public documentation for the project is available at: https://eagle-stack-documentation.netlify.app/

> The project’s identity and authentication layer is handled by Firebase Authentication. The application’s Formula 1 data is accessed through the project’s custom Express API rather than Firebase-generated endpoints.
