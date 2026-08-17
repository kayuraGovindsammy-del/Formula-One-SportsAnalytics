# Event Schema

*Member 1 — F1 Event & Data Model*

## 1. Why events instead of stored totals

The brief requires that statistics be **derived from event data**, not manually entered. Rather than storing laps, results, and standings as static rows that get edited directly, the platform records an **append-only log of events** for each session, and computes every statistic by processing that log.

This has one major benefit that directly answers a Sprint 1 requirement: **correcting a mistake means correcting one event, not hunting down every statistic it fed into.**

## 2. Event types

| Type | Fires when | Feeds into |
|---|---|---|
| `SESSION_START` | A session begins | Session boundaries |
| `SESSION_END` | A session ends | Session boundaries |
| `LAP_COMPLETED` | A driver crosses the line to complete a lap | Fastest lap, race pace, consistency, positions |
| `PIT_STOP` | A driver stops in the pit lane | Pit-stop count/time |
| `POSITION_CHANGE` | An overtake or position swap | Positions gained/lost |
| `PENALTY_ISSUED` | A steward decision affecting a driver | Final classification, points |
| `RETIREMENT` | A driver fails to finish | DNF rate, final classification |
| `FASTEST_LAP_SET` | A new fastest lap of the session is set | Fastest lap statistic |

## 3. Event structure

Every event shares a common envelope:

```json
{
  "event_id": "evt_001",
  "session_id": "2025_R13_RACE",
  "driver_id": "PIA",
  "type": "LAP_COMPLETED",
  "lap_number": 5,
  "timestamp": "2025-07-27T13:41:07Z",
  "payload": { }
}
```

| Field | Required | Notes |
|---|---|---|
| `event_id` | Yes | Unique identifier |
| `session_id` | Yes | Which session this event belongs to |
| `driver_id` | Depends | Not present on `SESSION_START`/`SESSION_END` |
| `type` | Yes | One of the types in §2 |
| `lap_number` | Depends | Present on lap-scoped events |
| `timestamp` | Yes | Wall-clock time, used to order events correctly on replay |
| `payload` | Yes | Type-specific fields, see below |

### `LAP_COMPLETED` payload
```json
{
  "lap_time_ms": 92481,
  "position": 1,
  "is_pit_lap": false,
  "is_valid": true
}
```
- `lap_time_ms` — milliseconds, not seconds/floats, to avoid rounding issues.
- `position` — the driver's race position *after* this lap.
- `is_pit_lap` — pit laps are excluded from race-pace calculations.
- `is_valid` — false if stewards deleted the lap (e.g. track limits); excluded from fastest-lap calculations.

### `PIT_STOP` payload
```json
{ "duration_ms": 2340, "tyre_in": "medium", "tyre_out": "hard" }
```

### `POSITION_CHANGE` payload
```json
{ "overtaken_driver_id": "NOR", "position_before": 2, "position_after": 1 }
```

### `PENALTY_ISSUED` payload
```json
{ "penalty_type": "TIME", "duration_ms": 5000, "reason": "Track limits, turn 4" }
```
`penalty_type` is one of `TIME`, `GRID_DROP`, `DISQUALIFICATION`.

### `RETIREMENT` payload
```json
{ "reason": "Engine failure" }
```

### `FASTEST_LAP_SET` payload
```json
{ "lap_time_ms": 104861 }
```

### `SESSION_START` / `SESSION_END` payload
Empty (`{}`) — these events exist purely to mark session boundaries in the log.

## 4. Correcting an event → recalculating statistics

Statistics are never stored as the source of truth — they're recomputed from the event log every time it's needed (or cached and invalidated when the underlying log changes). So the correction flow is:

1. A steward, admin, or approved submitter identifies an incorrect event (e.g. a lap time was logged wrong, or a pit stop duration was mistyped).
2. That specific event is corrected — either by editing the event in place (with an audit trail of the change) or, in a stricter append-only design, by appending a `CORRECTION` event that supersedes it.
3. Every derived statistic that depends on that session's event log is recalculated from the (now-corrected) log — fastest lap, race pace, consistency, positions gained/lost, and final classification are all just functions over the event stream, so there's no separate "fix the stats table" step.

This is also why `RaceResult` (§ in `data-model.md`) is documented as a derived entity rather than something submitted directly — it's the output of replaying the event log for a session, not an independent source of truth that could drift out of sync with it.

## 5. Sample implementation

`data/sample/events.json` demonstrates this schema with a real event log for the 2025 Belgian Grand Prix race session, covering every event type above. Fields tagged `"source": "real"` reflect confirmed race facts (pole time, the lap-5 lead change, the lap-32 fastest lap, final classification); fields tagged `"source": "illustrative"` are placeholder values included to demonstrate the schema shape and should be replaced with real lap-by-lap data (e.g. from the OpenF1 API) before being used for anything beyond that.


---
*This document was generated with the assistance of: Claude-Web[Claude Sonnet 5]*
