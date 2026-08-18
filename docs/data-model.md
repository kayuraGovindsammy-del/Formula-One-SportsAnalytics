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
                │              └─* Retirement
                │
Driver *─* Constructor   (linked per-season, since drivers can change teams)
Session 1─1 RaceResult *─1 Driver
```

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
The final classification for a session — this is a **derived** entity, computed from the events above, not entered manually (see `event-schema.md` §3).

| Field | Type | Notes |
|---|---|---|
| `session_id` | string | FK → Session |
| `driver_id` | string | |
| `constructor_id` | string | |
| `position` | integer | |
| `points` | number | |
| `laps_completed` | integer | |
| `status` | enum | `FINISHED`, `DNF`, `DSQ` |

## Sample data

Real 2025-season sample data implementing this model is in `data/sample/`:
- `drivers.json` — full 2025 driver roster
- `races.json` — full 2025 season calendar
- `events.json` — event log for one race session (Belgian GP), demonstrating the event types above
- `laps.json` — flat per-lap records for a subset of drivers

See `docs/event-schema.md` for the event log format these are derived from, and `docs/f1-statistics.md` for how statistics are computed from them.


---
*This document was generated with the assistance of: Claude-Web[Claude Sonnet 5]*