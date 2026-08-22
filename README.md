# Formula 1 Sport Analytics Platform

A Formula 1 sport analytics platform developed for COMS3011A.

The system allows users to explore Formula 1 drivers, races, race statistics, and event data. Approved submitters and administrators can also submit Formula 1 event data for review.

## Technology Stack

### Frontend
- React
- TypeScript
- Vite
- Firebase Authentication
- Firestore for user profiles, roles, and submitter approval status

### Backend
- Node.js
- Express
- TypeScript
- Firebase Admin SDK
- PostgreSQL

### Repository and Collaboration
- Gitea
- Git

## Architecture

The application uses a hosted backend and shared PostgreSQL database.

```text
React Frontend
      |
      v
Railway-hosted Express API
      |
      +--------------------------+
      |                          |
      v                          v
Firebase                    Neon PostgreSQL
Authentication              F1 Data
Firestore Roles             Submissions
## AI Usage

AI tools were used during the development of this project in accordance with the course AI usage policy.

### AI Code Generation

The following AI tools were used to assist with code generation:

- **ChatGPT-Web [GPT-5.6 Sol]**
  - Assisted with frontend and backend code generation.
  - Assisted with Firebase authentication and role-based access integration.
  - Assisted with the submission and admin review functionality.
  - Assisted with integrating the frontend with the backend API.
  - Assisted with PostgreSQL integration, database migration, development seed data, and local setup scripts.
  - Assisted with debugging and resolving implementation errors.

- **Claude-Web [Claude Sonnet 5]**
  - Assisted with code generation during development.

### AI Code Review

The following AI tool was used for code review:

- **Claude-Code [Claude Sonnet 5]**
  - Used to review project code and assist with identifying implementation issues.

### AI In-Line Editing

No AI in-line editing tools were used.

### Human Responsibility

All AI-assisted changes were reviewed, tested, and integrated by the project team. The team remains responsible for the final implementation and submitted work.