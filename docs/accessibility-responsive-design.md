# Accessibility and Responsive Design

This page records accessibility and small-screen behaviours visible in the
frontend implementation. It is implementation evidence, not a claim of
formal accessibility certification.

## Accessibility evidence

- The shared navbar uses semantic header/navigation landmarks, a list, and
  links. Login and submission forms provide associated labels.
- Interactive controls use accessible names where needed; the chat widget and
  data-feedback components use ARIA labels, live regions, or alert roles where
  appropriate.
- Keyboard focus is visible on navigation links through `:focus-visible`
  styling in `src/frontend/src/index.css`.
- The race timeline and chat widget include reduced-motion rules using
  `prefers-reduced-motion`.

These practices support structure, labeling, keyboard focus visibility, and
motion preferences. The repository does not document a complete WCAG audit,
automated accessibility test suite, or systematic contrast testing.

## Responsive behaviour

- The shared navigation adjusts spacing at widths below 1100px. Below 900px
  it wraps, places its links in a full-width horizontally scrollable row, and
  keeps each link on one line. Below 500px it reduces navigation and account
  control sizing. It does not switch to a collapsed hamburger menu.
- Frontend styles use page- and component-specific media queries to adapt
  layouts at narrower widths; `src/frontend/src/index.css` includes additional
  breakpoints beyond the shared navigation.
- Responsive behaviour is implemented in CSS. The project does not report
  results from a formal device/browser matrix or automated responsive visual
  regression suite.

## Evidence locations

- Shared navigation, focus treatment, and navigation breakpoints:
  `src/frontend/src/index.css`.
- Semantic navigation: `src/frontend/src/components/Navbar.tsx`.
- Form labels: `src/frontend/src/pages/Login/Login.tsx` and
  `src/frontend/src/pages/SubmitData/SubmitData.tsx`.
- Chat widget ARIA and reduced-motion handling:
  `src/frontend/src/components/chat/ChatWidget.tsx` and
  `src/frontend/src/components/chat/ChatWidget.css`.
- Race timeline reduced-motion handling:
  `src/frontend/src/components/RaceTimeline.css`.
- Sprint 3 user-feedback evidence:
  [Sprint 3 User Testing Evidence](user-testing/sprint3-user-testing.md).
