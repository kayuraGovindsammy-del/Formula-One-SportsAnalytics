# Data Model

*Member 1 — F1 Event & Data Model*

This document defines the entities the platform records for Formula 1, and how they relate to one another.

## Overview

```
Season 1─* GrandPrix 1─* Session 1─* Lap
                │              │
                │              ├─* PitStop
                │              ├─* PositionChange
                │              ├─* Penalty
                │              ├─* Retirement
                │              ├─* RaceResult *─1 Driver
                │              ├─* QualifyingResult *─1 Driver
                │              └─* Submission 0..1─1 AcceptedEvent
                │
Driver *─* Constructor   (linked per-season, since drivers can change teams)
User 1─* Submission      (submitter; reviewed_by also points at a User)
AccountDeletion          (standalone, keyed by Firebase UID)
```

`RaceResult` and `QualifyingResult` have one row per driver per session (a session holds many, not one). `Submission`, `AcceptedEvent`, `User` and `AccountDeletion` support the workflow/account relationships; submissions and accepted events retain complete event envelopes alongside the normalized sports rows.

**Key design decision:** `Session` (not `Race`) is the atomic unit of the model. A Grand Prix weekend has several sessions — practice, qualifying, sprint, race — and laps, pit stops, and position changes all happen *within* a session, not within the weekend as a whole.

## Entities

### Season
A single F1 championship year (e.g. 2025).

| Field | Type | Notes |
|---|---|---|
| `season_id` | string | e.g. `"2025"` |
| `year` | integer | |

### GrandPrix
One race weekend, tied to a circuit.

| Field | Type | Notes |
|---|---|---|
| `grand_prix_id` | string | e.g. `"2025_R13"` |
| `season_id` | string | FK → Season |
| `round` | integer | Position in the season calendar (1–24) |
| `race_name` | string | e.g. `"Belgian Grand Prix"` |
| `circuit_id` | string | FK → Circuit |
| `date` | date | Date of the main race |
| `has_sprint` | boolean | Whether this weekend uses the sprint format |

### Circuit
A physical track. Circuits are reused across seasons, so they're modelled independently of GrandPrix.

| Field | Type | Notes |
|---|---|---|
| `circuit_id` | string | e.g. `"spa"` |
| `circuit_name` | string | |
| `locality` | string | |
| `country` | string | |

### Session
A single timed session within a GrandPrix weekend. This is where events actually happen.

| Field | Type | Notes |
|---|---|---|
| `session_id` | string | e.g. `"2025_R13_RACE"` |
| `grand_prix_id` | string | FK → GrandPrix |
| `type` | enum | `PRACTICE_1`, `PRACTICE_2`, `PRACTICE_3`, `QUALIFYING`, `SPRINT_QUALIFYING`, `SPRINT`, `RACE` |
| `total_laps` | integer | Scheduled/actual lap count (race/sprint sessions only) |
| `start_time` | timestamp | |
| `end_time` | timestamp | |

### Driver
| Field | Type | Notes |
|---|---|---|
| `driver_id` | string | 3-letter code, e.g. `"PIA"` |
| `permanent_number` | integer | |
| `given_name` | string | |
| `family_name` | string | |
| `nationality` | string | |
| `date_of_birth` | date | |

### Constructor
| Field | Type | Notes |
|---|---|---|
| `constructor_id` | string | e.g. `"MCL"` |
| `name` | string | |
| `nationality` | string | |

### DriverConstructorLink
Because drivers change teams between (and occasionally within) seasons, team membership is its own entity rather than a fixed field on Driver.

| Field | Type | Notes |
|---|---|---|
| `season_id` | string | FK → Season |
| `driver_id` | string | FK → Driver |
| `constructor_id` | string | FK → Constructor |

### Lap
One completed lap by one driver in one session. See `event-schema.md` for the full `LAP_COMPLETED` event definition — this row is the derived/stored form of that event.

| Field | Type | Notes |
|---|---|---|
| `session_id` | string | FK → Session |
| `driver_id` | string | FK → Driver |
| `lap_number` | integer | |
| `lap_time_ms` | integer | Milliseconds, not seconds — avoids rounding issues |
| `position` | integer | Position after this lap |
| `is_pit_lap` | boolean | Excluded from race-pace calculations if true |
| `is_valid` | boolean | False if stewards deleted the lap |

### PitStop
| Field | Type | Notes |
|---|---|---|
| `session_id` | string | FK → Session |
| `driver_id` | string | FK → Driver |
| `lap_number` | integer | |
| `duration_ms` | integer | |

### PositionChange
| Field | Type | Notes |
|---|---|---|
| `session_id` | string | FK → Session |
| `driver_id` | string | Driver who gained the position |
| `overtaken_driver_id` | string | Driver who lost the position |
| `lap_number` | integer | |
| `position_before` | integer | |
| `position_after` | integer | |

### Penalty
| Field | Type | Notes |
|---|---|---|
| `session_id` | string | FK → Session |
| `driver_id` | string | |
| `lap_number` | integer | |
| `penalty_type` | enum | `TIME`, `GRID_DROP`, `DISQUALIFICATION` |
| `duration_ms` | integer \| null | Only for `TIME` penalties |
| `reason` | string | |

### Retirement
| Field | Type | Notes |
|---|---|---|
| `session_id` | string | |
| `driver_id` | string | |
| `lap_number` | integer | |
| `reason` | string | e.g. `"Engine failure"`, `"Collision"` |

### RaceResult
The final classification for a session (`race_results` table, one row per driver per session).

For races loaded by the Jolpica ingestion this is **stored published data**: the row is written straight from the source, including `points`, `grid_position` and the fastest-lap fields, and no lap log exists behind it. It is a **derived** entity only where it is computed from the events above (see `event-schema.md` §3). The statistics code prefers derived values and uses these stored columns as a fallback (see `f1-statistics.md`, "Fallback to ingested `race_results`"), except for `points`, where the stored value is preferred.

| Field | Type | Notes |
|---|---|---|
| `session_id` | string | FK → Session. Primary key with `driver_id` |
| `driver_id` | string | FK → Driver |
| `constructor_id` | string | FK → Constructor. The team the driver scored for in this race (constructor points are summed by this column) |
| `position` | integer \| null | Classified finishing position, > 0. NULL for an unclassified driver |
| `grid_position` | integer \| null | Starting grid slot, >= 0. `0` is a pit-lane start. NULL when unknown |
| `points` | number | Published points for this race, default 0 |
| `laps_completed` | integer | Default 0 |
| `pit_stops` | integer | Default 0, >= 0 |
| `gap_to_winner_ms` | integer \| null | Milliseconds behind the winner, >= 0 |
| `fastest_lap_rank` | integer \| null | Rank of the driver's fastest lap in the session, > 0 (1 = quickest) |
| `fastest_lap_number` | integer \| null | Lap on which it was set, > 0 |
| `fastest_lap_time_ms` | integer \| null | Its lap time in milliseconds, > 0 |
| `status` | enum | `FINISHED`, `DNF`, `DSQ` |

### QualifyingResult
The published qualifying classification for a `QUALIFYING` session (`qualifying_results` table, one row per driver per session). Like ingested `RaceResult` rows this is stored Jolpica data; the ingestion writes these rows but no events for the session. It is served by `GET /races/{grand_prix_id}/qualifying`, including for frontend heuristic predictions, but does not feed backend season-statistics derivation.

| Field | Type | Notes |
|---|---|---|
| `session_id` | string | FK → Session. Primary key with `driver_id` |
| `driver_id` | string | FK → Driver |
| `constructor_id` | string | FK → Constructor |
| `position` | integer | Qualifying classification, > 0 |
| `q1_time_ms` | integer \| null | Best Q1 lap in milliseconds, > 0 |
| `q2_time_ms` | integer \| null | Best Q2 lap in milliseconds, > 0 |
| `q3_time_ms` | integer \| null | Best Q3 lap in milliseconds, > 0 |

### User
An application account mirror (`users` table). Identity comes from Firebase Auth and the backend authorizes against the current Firestore `users/{uid}` profile. Submission creation/review upserts this SQL row from that verified identity/profile for stable contributor/reviewer foreign keys; stored SQL role/status are not the source of current privileges.

| Field | Type | Notes |
|---|---|---|
| `user_id` | integer | Primary key, generated |
| `auth_uid` | string | Firebase Auth UID, unique |
| `email` | string | Unique |
| `display_name` | string \| null | |
| `role` | enum | `USER` (default), `SUBMITTER`, `ADMIN` |
| `submitter_status` | enum | `NONE` (default), `PENDING`, `APPROVED`, `REJECTED` |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### Submission
A user-submitted event awaiting or past review (`submissions` table). The event payload follows `event-schema.md` §3.

| Field | Type | Notes |
|---|---|---|
| `submission_id` | integer | Primary key, generated |
| `submitter_user_id` | integer | FK → User |
| `session_id` | string | FK → Session |
| `status` | enum | `PENDING` (default), `ACCEPTED`, `REJECTED` |
| `event_data` | JSON | The submitted event, as submitted |
| `source_filename` | string \| null | |
| `validation_message` | string \| null | Single reviewer message; a rejection reason is stored here |
| `submitted_at` | timestamp | |
| `reviewed_at` | timestamp \| null | |
| `reviewed_by` | integer \| null | FK → User (the reviewing admin) |

### AcceptedEvent
The record of an accepted submission (`accepted_events` table). At most one per submission.

| Field | Type | Notes |
|---|---|---|
| `event_id` | string | Primary key |
| `submission_id` | integer | FK → Submission, unique |
| `session_id` | string | FK → Session |
| `event_data` | JSON | Must be a JSON object |
| `accepted_at` | timestamp | |

### AccountDeletion
An account-deletion request (`account_deletions` table). The row is kept after the deletion as a tombstone, so a deleted Firebase UID cannot recreate its profile, and `attempts` / `last_attempt_at` track retries of a deletion that has not yet completed. It is keyed by the Firebase UID with no foreign key to `users`, so it survives removal of the user row.

| Field | Type | Notes |
|---|---|---|
| `auth_uid` | string | Primary key |
| `requested_at` | timestamp | |
| `completed_at` | timestamp \| null | Set when the deletion has finished |
| `attempts` | integer | Default 0, >= 0 |
| `last_attempt_at` | timestamp \| null | |

## Sample data

Real 2025-season sample data implementing this model is in `data/sample/`:
- `drivers.json` — sample 2025 driver roster
- `races.json` — full 2025 season calendar
- `events.json` — Belgian GP race and qualifying event samples
- `laps.json` — flat per-lap records for a subset of drivers

See `docs/event-schema.md` for the event log format these are derived from, and `docs/f1-statistics.md` for how statistics are computed from them.


---
*This document was edited with the assistance of: Claude-Web[Claude Sonnet 5], Claude-Code[Claude Sonnet 5]*
