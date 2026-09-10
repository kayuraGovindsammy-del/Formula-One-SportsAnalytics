# F1 Statistics Catalogue

*Member 1 — F1 Event & Data Model*

Every statistic below is computed from the event log defined in `event-schema.md`, not entered manually. Statistics are split into raw (directly observed from a single event) and derived (computed by aggregating over events).

## 1. Per-lap / per-session (raw)

| Statistic | Derived from |
|---|---|
| Lap time | `LAP_COMPLETED.payload.lap_time_ms` |
| Pit stop count | `count(PIT_STOP)` grouped by driver + session |
| Pit stop duration | `PIT_STOP.payload.duration_ms` |
| Position per lap | `LAP_COMPLETED.payload.position` |

## 2. Per-race (derived)

| Statistic | Formula |
|---|---|
| Finishing position | Final `position` from the last valid `LAP_COMPLETED` event of the session, or the position recorded at `RETIREMENT` |
| Positions gained/lost | Starting grid position (from the qualifying session's classification) minus finishing position |
| Fastest lap | `min(lap_time_ms)` where `is_valid = true` and `is_pit_lap = false`, across all `LAP_COMPLETED` events in the session |
| Race pace | `average(lap_time_ms)` where `is_valid = true` and `is_pit_lap = false` — pit laps are excluded because they're artificially slow |
| Consistency | `stddev(lap_time_ms)` over the same filtered set used for race pace — lower stddev = more consistent |
| DNF (per race) | `true` if a `RETIREMENT` event exists for that driver in that session |

## 3. Per-season (aggregated)

| Statistic | Formula |
|---|---|
| Driver points | `sum(points)` from each session's derived `RaceResult`, across all races in the season |
| Constructor points | `sum(points)` of both drivers registered to that constructor for the season |
| DNF rate | `count(sessions with RETIREMENT for this driver) / count(sessions entered)` |
| Qualifying-vs-race performance | `average(race finishing position − qualifying position)` across all races in the season — negative means the driver typically gains positions in the race |

### Points-per-position table

`points` above is `sum(pointsForPosition(finishing_position))` per race session, using the standard F1 scale:

| Position | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11+ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Points | 25 | 18 | 15 | 12 | 10 | 8 | 6 | 4 | 2 | 1 | 0 |

Constructor points are the sum of both registered drivers' points for the season — not a separately-scored total.

**Not yet computed, because no scale is defined for them:**
- **Fastest-lap bonus point.** The real F1 scale awards +1 point for the fastest lap of the race (usually conditional on finishing in the top 10). No such rule is documented here or in `api-design.md`, so it is not applied.
- **Sprint session points.** §4 above already flags that sprint sessions use "a smaller points scale," but that scale itself has never been specified. Sprint session classifications are not run through the points table above until one is.

**Sample-data coverage.** `data/sample/laps.json` only carries lap data through to each driver's actual finish for PIA, NOR and LEC — ANT's only recorded lap (32) is a mid-race snapshot, not his finish. So points can currently only be trusted for PIA, NOR and LEC; any figure derived for a driver without full lap coverage reflects whatever position happens to be in the log, not necessarily their real result. See issue #55 for the tracked follow-up to expand sample data coverage.

## 4. Notes on edge cases

- **Sprint sessions** produce their own separate `RaceResult` with a smaller points scale — sprint points and race points are summed together for the season total but should be tracked as distinct sessions so per-session statistics (fastest lap, race pace, etc.) aren't mixed between a sprint and the main race.
- **Safety car / red flag periods** distort lap times significantly. A future iteration of this schema could add an `is_under_safety_car` flag to `LAP_COMPLETED` so race-pace/consistency calculations can exclude those laps too — out of scope for the Sprint 1 sample data, but worth flagging for Member 2/4 as the schema evolves.
- **Penalties** applied after a session (e.g. a post-race time penalty) mean the finishing order derived purely from `LAP_COMPLETED` events may need adjusting by any `PENALTY_ISSUED` events before the final `RaceResult` classification is correct.

## 5. External data sources

- **[Jolpica-F1](https://api.jolpi.ca/ergast/f1/)** — open-source, actively maintained successor to the now-shut-down Ergast API. Same JSON response shape as Ergast. Used for season schedules, driver/constructor rosters, and race classifications. Covers 1950 to the current season.
- **[OpenF1](https://openf1.org)** — covers what Jolpica doesn't: lap-by-lap timing, pit stop timing, and live session data. Used (or intended for future use) for the granular `LAP_COMPLETED`/`PIT_STOP` event detail.

**Why two sources:** no single free API covers both season-level structure (schedule, results, standings) and session-level granularity (lap times, pit stop timing) well. Jolpica is the right shape for the "static" entities (Season, GrandPrix, Driver, Constructor, RaceResult); OpenF1 is the right shape for the event log itself.

## 6. Sample implementation

`data/sample/events.json` and `data/sample/laps.json` demonstrate a subset of these statistics computed against real 2025 Belgian Grand Prix data. See the `_note` and `source` fields in those files for which values are confirmed real race facts vs. illustrative placeholders.


---
*This document was generated with the assistance of: Claude-Web[Claude Sonnet 5]*