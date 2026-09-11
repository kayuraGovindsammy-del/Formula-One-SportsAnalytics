# F1 Statistics Catalogue

*Member 1 — F1 Event & Data Model*

Every statistic below is computed from the event log defined in `event-schema.md`, not entered manually. Statistics are split into raw (directly observed from a single event) and derived (computed by aggregating over events).

## Implementation status

"Done and verified" means a pure function exists with passing unit tests. Whether that function's output is actually reachable through a live HTTP response is a separate question, called out explicitly per row where it isn't the obvious case.

| Statistic | Status | Detail |
|---|---|---|
| Lap time | Done and verified | Used throughout `lapStatistics.ts` (`isRacingLap`, `averageLapTime`, `fastestLap`); not a standalone output field itself |
| Pit stop count | Done and verified | `pitStatistics.ts`'s `pitStopCount`, tested in `pitStatistics.test.ts`. Live via `/races/:grand_prix_id/statistics` (`pit_stop_count`, `classification[].pit_stops`), fully derived for `2025_R13` (`races.controller.ts` only falls back to the stored `race_results` block when the derived classification is empty). `classification[].pit_stops` is `0` for VER/RUS/ALB/HAM/LAW/BOR/GAS specifically, though — only a `LAP_COMPLETED` event was added for each (issue #55), no `PIT_STOP` event, so the derivation honestly reports 0 rather than their real count of 1 |
| Pit stop duration | Implemented, not exposed | `totalPitTime()` in `pitStatistics.ts`, tested in isolation in `pitStatistics.test.ts`; no route or statistics object surfaces it anywhere |
| Position per lap | Implemented, not reachable via the API | `runningOrder.ts`'s `runningOrderAtLap`, tested in `runningOrder.test.ts`; no lap-by-lap position route exists |
| Finishing position | Done and verified | `finishingPosition()` (`driverStatistics.ts`) and `lastRecordedLap()` (`raceStatistics.ts`). Live via `/drivers/:id/stats` (`average_finish_position`) and `/races/:id/statistics` (`classification[].position`), both fully derived for `2025_R13` |
| Positions gained/lost (per-race) | Not implemented | Only the season-averaged form exists (`positions_gained_lost_avg`, see below) — no per-race "gained N places in this race" field exists in `ClassificationRow` or anywhere else |
| Fastest lap | Done and verified | `fastestLap()` (`lapStatistics.ts`), tested in `lapStatistics.test.ts` and `raceStatistics.test.ts`. Live via `/races/:id/statistics` (`fastest_lap`, field name `lap_time_ms`), fully derived for `2025_R13` — `races.controller.ts` only falls back to the stored block's shape (field name `time_ms`) when no fastest lap can be derived at all |
| Race pace | Done and verified, season-level only | `averageLapTime()` (`lapStatistics.ts`) and `average_race_pace_ms` (`driverStatistics.ts`), both tested, live via `/drivers/:id/stats`. There is no per-race (single-session) race-pace field in `raceStatistics.ts` — unlike consistency, which does have one |
| Consistency | Done and verified | `lapConsistency()` (`lapStatistics.ts`) wired into `classification[].consistency_ms` (`raceStatistics.ts`), tested in both, live via `/races/:id/statistics` (fully derived for `2025_R13`) |
| DNF (per race) | Done and verified | `retirement_count`/`dnf_count` (`raceStatistics.ts`), tested, live via `/races/:id/statistics` |
| Driver points | Done and verified | `pointsForPosition()` (`pointsTable.ts`, tested in `pointsTable.test.ts`) and `points` (`driverStatistics.ts`, tested). Live via `/drivers/:id/stats` for all 10 classified Belgian GP drivers (issue #55). Base race scale only — see below for what's excluded |
| Constructor points | Done and verified, not reachable via the API | `buildConstructorStatistics()` (`constructorStatistics.ts`), tested in `constructorStatistics.test.ts`. No route or controller exists for constructor statistics at all |
| DNF rate | Done and verified | `dnf_rate` (`driverStatistics.ts`), tested, live via `/drivers/:id/stats` |
| Qualifying-vs-race performance | Done and verified, not reachable via the API | Implemented as `positions_gained_lost_avg` (`driverStatistics.ts`), tested against real sample data (PIA/NOR/LEC) and 5 hand-constructed cases in `driverStatistics.test.ts`. `drivers.controller.ts` never fetches or attaches `qualifying_events` when building its input, so this field always returns `null` over HTTP regardless of season — tracked in issue #62 |

**Not implemented at all:**
- **Fastest-lap bonus point.** No scale for it is documented anywhere in this file or `api-design.md`.
- **Sprint session points.** No sprint points scale is documented anywhere, and no sprint session sample data exists either — `data/sample/races.json` marks round 13 as `has_sprint: true`, but `data/sample/events.json` has no sprint session's events.
- **Safety-car-aware race pace/consistency.** No `is_under_safety_car` flag exists on `LAP_COMPLETED` in the event schema.
- **Penalty-adjusted classification.** `PENALTY_ISSUED` is a defined event type (`event.types.ts`), but no service reads it.

**Sample-data trust boundaries** (issue #55 tracks expanding coverage further):
- **PIA, NOR, LEC** — full lap coverage through their actual race finish, and a qualifying grid entry each. Finishing position, points, pace, consistency and `positions_gained_lost_avg` are all trustworthy for these three, with one caveat: LEC's grid position is an unconfirmed placeholder (`"source": "illustrative"` in `events.json`), not a sourced fact.
- **VER, RUS, ALB, HAM, LAW, BOR, GAS** — one recorded lap each (lap 44, their real classification position from `session_result.classification`). Finishing position and points are trustworthy for these seven — that one lap genuinely is their finish, unlike ANT below. Pace and consistency are **not** trustworthy: the lap time itself is an illustrative placeholder (`"source": "illustrative"`), and a single lap makes `consistency_ms` come back `0` by construction rather than a real measure of spread. None have a qualifying event, so `positions_gained_lost_avg` correctly stays `null` for all seven.
- **ANT** — only one recorded lap (32), a mid-race snapshot rather than his finish — the opposite situation to the seven drivers above (his lap time is real, but his position isn't his finish). His points and `average_finish_position` reflect that mid-race position, not his real result. He has no qualifying event either, so `positions_gained_lost_avg` correctly stays `null`.
- **Everyone else** (every other driver/race outside the Belgian GP) — zero lap/event data in the sample set. Routes correctly return the "no data" shape (`races_entered: 0`, nulls) for these, not fabricated numbers.

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

**Sample-data coverage.** All 10 drivers classified in `session_result.classification` (PIA, NOR, LEC, VER, RUS, ALB, HAM, LAW, BOR, GAS) now have a real, sourced finishing position in the event/lap log, so points are trustworthy for all 10 (issue #55). ANT is the one exception: his only recorded lap (32) is a mid-race snapshot, not his finish, so his points reflect that mid-race position rather than his real result. See the "Sample-data trust boundaries" list above for the pace/consistency caveat that still applies to the 7 most recently added drivers.

### Positions gained/lost — sign convention

§2's "Positions gained/lost" (`grid − finish`, positive = gained places) and §3's "Qualifying-vs-race performance" (`finish − qualifying`, negative = gained places) describe the same underlying comparison with opposite signs. There is one field for this, `positions_gained_lost_avg`, implementing §2's convention (positive = gained places) — not two separately-signed fields. To read a value as §3's figure instead, negate it.

**Sample-data coverage.** `data/sample/events.json` now includes a minimal `2025_R13_QUALIFYING` session (`evt_011`-`evt_013`): one `LAP_COMPLETED` event per driver, position-only, for PIA, NOR and LEC — the same three drivers whose race finishing position is trustworthy (see above). NOR's pole position and PIA's P2 grid slot are corroborated by existing data (`session_result.pole_position`, and `evt_004`'s `position_before` with no earlier `POSITION_CHANGE`) and marked `"source": "real"`. LEC's grid position is an unconfirmed placeholder marked `"source": "illustrative"` — replace it with the real qualifying classification (Jolpica/ESPN) before treating it as fact. See issue #55.

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
*This document was generated with the assistance of: Claude-Web[Claude Sonnet 5], Claude-Code[Claude Sonnet 5]*