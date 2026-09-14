# Sprint 2 User Testing Evidence

This page records verified Sprint 2 user-testing evidence for the SportsAnalytics frontend. It uses only repository facts and the local Google Form CSV that was uploaded during the Sprint 2 review process.

## Testing window

- Responses were collected between 11 and 13 September 2026.
- Total responses: 7
- External users: 6
- Stakeholder response: 1

The stakeholder row was identified internally as Risuna Ntimana and is reported separately below. External-user results are aggregated only and do not include names.

## External-user-only results

The following averages are calculated from the 6 external-user responses only.

| Question | External-user average |
| --- | --- |
| How easy was it to navigate around the F1 Analytics website? | 4.83 / 5 |
| How would you rate the overall design and appearance of the website? | 4.83 / 5 |
| How easy was it to find a specific driver and view their information? | 4.67 / 5 |
| How easy was it to find a race and view its information and results? | 4.67 / 5 |
| Did the colours, images, circuit layouts and overall F1 theme make the website visually appealing and easy to understand? | 5.00 / 5 |

### External-user qualitative feedback

Positive themes that appeared across the external-user responses:

- The site was considered easy to navigate.
- The overall design and visual style were seen as polished and appealing.
- The drivers, constructors, races, and statistics pages were described as clear and intuitive.
- Users highlighted the race-track visuals, race information, and the overall responsive experience.

Common improvement suggestions from the external-user responses:

- Add a more obvious search icon or improve the search affordance.
- Improve the header navigation styling to better match the rest of the site.
- Add team grouping when searching for individual drivers.
- Consider a predicted-time section for races.
- Improve contrast on the China track map text where black text appears on a dark background.

## Stakeholder feedback summary

One stakeholder response was recorded and is reported separately from the external-user averages.

The stakeholder feedback was broadly positive:

- The website was described as visually polished.
- The driver search and team filtering were specifically praised.
- The site was seen as providing a clear overview of available sections.

The stakeholder also identified one clear improvement area:

- The contribution workflow could be made clearer after a submission request is made, especially around the meaning of the pending status and what happens next.

## Key findings

1. The external-user sample was strongly positive about design, visual appeal, and ease of navigation.
2. The strongest positive themes were the F1 visual identity, the track/race presentation, and the overall clean layout.
3. The most consistent improvement requests were about search/visual affordances and contribution-workflow clarity.
4. The repository already contains evidence of several of these improvements being implemented during the Sprint 2 feedback period, with the timestamp sequence supporting that the feedback preceded the implementation.

## Traceability to the current repository

| Evidence item | Repository evidence | Notes |
| --- | --- | --- |
| Header/navigation redesign | `src/frontend/src/components/layout/Navbar.tsx`, `src/frontend/src/index.css` | The current navbar includes F1-themed styling, active-page states, and improved layout. |
| Search affordance on content pages | `src/frontend/src/pages/Drivers/Drivers.tsx`, `src/frontend/src/pages/Races/Races.tsx`, `src/frontend/src/pages/Constructors/Constructors.tsx` | All three pages currently include search controls with inline search icons. |
| Automated UI testing | `src/frontend/e2e/navigation.spec.ts` | The current Playwright suite contains five unauthenticated tests for login-page UI behaviour. |
| Testing documentation update | `docs/testing.md` | This page now states the current Playwright implementation accurately. |

## Implementation traceability

The following implementation evidence was verified in the repository history:

- Commit `632fbad` contains the frontend navigation redesign and related CSS updates that align with the user feedback about the header and overall styling.
- The current pages for Drivers, Races, and Constructors already contain search controls with inline search icons.
- The Playwright suite in `src/frontend/e2e/navigation.spec.ts` reflects the current implementation and is limited to unauthenticated login-page checks.

## Automated UI testing note

The current automated UI testing setup in the repository is a real Playwright smoke test, but it is not yet a broad authenticated end-to-end suite.

Current verified scope:

- `src/frontend/e2e/navigation.spec.ts`
- Five unauthenticated tests that verify:
  1. the login page loads at `/`
  2. the email and password fields are visible
  3. the sign-in and Google sign-in controls are visible
  4. the password reset option is visible
  5. the registration option is visible

This means the repository contains meaningful frontend smoke coverage for the login page, but it does not yet cover every major authenticated user journey in the application.

## Evidence and limitations

This Sprint 2 evidence page is intentionally conservative:

- It is based on the uploaded Google Form CSV and the verified repository state.
- It separates external-user results from the stakeholder response.
- It does not invent or assume unverified outcomes.
- It does not claim that every suggested improvement has already been implemented.

The evidence supports the conclusion that Sprint 2 external-user feedback was strongly positive overall, with the main remaining opportunities focused on search affordances, visual polish consistency, and clearer contribution workflow guidance.
