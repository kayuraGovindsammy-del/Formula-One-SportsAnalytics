# Event Schema

*Member 1 — F1 Event & Data Model*

## 1. Why events instead of stored totals

The brief requires that statistics be **derived from event data**, not manually entered. Reviewed submissions retain their complete event envelopes and publish normalized rows, which feed the statistics engine. Public requests compute statistics from persisted laps/events; published Jolpica classification, grid, points and fastest-lap facts supplement those derivations when telemetry is absent (see [F1 Statistics](f1-statistics.md)).

This design keeps raw observations separate from computed totals. The original correction proposal is described in §4; an event-edit/correction API has not been implemented.

## 2. Event types

| Type | Fires when | Feeds into |
|---|---|---|
| `SESSION_START` | A session begins | Session boundaries |
| `SESSION_END` | A session ends | Session boundaries |
| `LAP_COMPLETED` | A driver crosses the line to complete a lap | Fastest lap, race pace, consistency, positions |
| `PIT_STOP` | A driver stops in the pit lane | Pit-stop count/time |
| `POSITION_CHANGE` | An overtake or position swap | Race `overtake_count`; season positions gained/lost uses grid minus finish instead |
| `PENALTY_ISSUED` | A steward decision affecting a driver | Preserved/exposed; classification and points are not adjusted by this event |
| `RETIREMENT` | A driver fails to finish | Retirement count and DNF rate; does not supply a finishing position |
| `FASTEST_LAP_SET` | A new fastest lap of the session is set | Preserved marker; fastest lap is derived from valid racing laps or published results |

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
| `timestamp` | Yes for submissions | ISO timestamp with an offset. Reconstructed source/legacy SQL events use `null`; the public event list orders by `event_id` |
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

`lap_time_ms` and `position` may be `null` when unknown. Pace, fastest lap and consistency include only valid, non-pit laps with a non-null lap time. Classification uses the highest recorded lap number's position; it does not filter that lap by validity or infer that an incomplete log contains the actual finish.

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

The submission validator requires a positive `duration_ms` for `TIME` and `null` for other penalty types. Penalty lap number is optional; retirement lap number is optional or nonnegative. Session boundaries omit driver/lap fields and require an empty payload. Other lap-scoped events require a positive lap number. All submitted objects are strict: unknown envelope/payload fields (including sample-only `source`) are rejected.

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

## 4. Publication and the proposed correction flow

Acceptance stores the envelope in `accepted_events` and its applicable normalized row in the same PostgreSQL transaction as the review. `events.model.ts` reads accepted envelopes together with only normalized rows whose `submission_id IS NULL`; it does not re-add normalized rows that already have an envelope. Those reconstructed rows have synthetic `legacy_*` IDs and `timestamp: null`. Lap readers use the normalized `laps` table directly. Pending/rejected submissions are excluded.

Public statistics are computed per request. Chat season inputs/constructor standings/names are cached for ten minutes, without write-triggered invalidation. Source ingestion may rebuild external rows, preserving approved submissions, so the complete SQL event view is not an immutable append-only stream.

The original **proposed** correction flow is:

1. A steward, admin, or approved submitter identifies an incorrect event (e.g. a lap time was logged wrong, or a pit stop duration was mistyped).
2. That specific event is corrected — either by editing the event in place (with an audit trail of the change) or, in a stricter append-only design, by appending a `CORRECTION` event that supersedes it.
3. Every derived statistic that depends on that session's event log is recalculated from the (now-corrected) log — fastest lap, race pace, consistency, positions gained/lost, and final classification are all just functions over the event stream, so there's no separate "fix the stats table" step.

No `CORRECTION` event type or edit/delete endpoint exists. Current submission review allows a single pending-to-accepted/rejected transition, and duplicate pending/accepted event IDs are rejected. Ingested `RaceResult` rows are published source data rather than replay output; the exact precedence is documented in [Data Model](data-model.md) and [F1 Statistics](f1-statistics.md).

## 5. Sample implementation

`data/sample/events.json` demonstrates a subset of the schema for the 2025 Belgian Grand Prix race and qualifying sessions: boundaries, laps, pit stops, a position change and a fastest-lap marker. It contains no penalty or retirement examples. Source annotations distinguish confirmed race facts from illustrative placeholders; some rows marked `"source": "real"` confirm a position while their note still identifies the lap time as illustrative. These fixtures are not complete race telemetry or valid submission bodies as-is (see §3).


---
*This document was generated with the assistance of: Claude-Web[Claude Sonnet 5]*
