# F1 Statistics Catalogue

*Member 1 — F1 Event & Data Model*

Statistics are computed from the persisted laps/event log defined in `event-schema.md`, with published Jolpica `race_results` facts used as documented below when telemetry is absent. Stored points are preferred over the derived fallback. Statistics are split into raw (directly observed) and derived (computed by aggregating observations).

All driver/constructor season statistics and chat standings select `RACE` sessions only. They exclude sprint points even if the importer was run with `--include-sprints`; the totals are Grand Prix points, not official championship totals. The source-only export can still contain those stored sprint rows.

## Implementation status

"Done and verified" means a pure function exists with passing unit tests. Whether that function's output is actually reachable through a live HTTP response is a separate question, called out explicitly per row where it isn't the obvious case.

| Statistic | Status | Detail |
|---|---|---|
| Lap time | Done and verified | Used throughout `lapStatistics.ts` (`isRacingLap`, `averageLapTime`, `fastestLap`); not a standalone output field itself |
| Pit stop count | Done and verified | `pitStatistics.ts`'s `pitStopCount`, tested in `pitStatistics.test.ts`. Live via `/races/:grand_prix_id/statistics` (`pit_stop_count`, `classification[].pit_stops`), fully derived for `2025_R13` (`races.controller.ts` only falls back to the stored `race_results` block when the derived classification is empty). `classification[].pit_stops` is `0` for VER/RUS/ALB/HAM/LAW/BOR/GAS specifically, though — only a `LAP_COMPLETED` event was added for each (issue #55), no `PIT_STOP` event, so the derivation honestly reports 0 rather than their real count of 1 |
| Pit stop duration | Raw values exposed; aggregate helper not exposed | `totalPitTime()` in `pitStatistics.ts` is tested in isolation and no statistics response surfaces that aggregate. Individual `PIT_STOP.payload.duration_ms` values are public event data and the chat event tool reports the fastest recorded stop |
| Position per lap | Raw values exposed; running-order helper not exposed | `runningOrder.ts`'s `runningOrderAtLap` is tested but has no dedicated route. `/races/:id/laps` returns each stored lap's `position` |
| Finishing position | Done and verified | `finishingPosition()` (`driverStatistics.ts`) and `lastRecordedLap()` (`raceStatistics.ts`). Exposed via `/drivers/:id/stats` (`average_finish_position`, `wins`, `podiums`) and `/races/:id/statistics` (`classification[].position`). Driver stats fall back per driver when the last lap supplies no position. Race statistics fall back to the whole published classification only when the derived classification is empty; a partial derived classification is not filled out |
| Positions gained/lost (per-race) | Not implemented | Only the season-averaged form exists (`positions_gained_lost_avg`, see below) — no per-race "gained N places in this race" field exists in `ClassificationRow` or anywhere else |
| Fastest lap | Done and verified | `fastestLap()` (`lapStatistics.ts`), tested in `lapStatistics.test.ts` and `raceStatistics.test.ts`. `fastest_laps` on `/drivers/:id/stats` also falls back to the stored `race_results.fastest_lap_rank = 1` flag, but only for a session in which no driver has any laps. Live via `/races/:id/statistics` (`fastest_lap`, field name `lap_time_ms`), fully derived for `2025_R13` — `races.controller.ts` only falls back to the stored block's shape (field name `time_ms`) when no fastest lap can be derived at all |
| Race pace | Done and verified, season-level only | `averageLapTime()` (`lapStatistics.ts`) and `average_race_pace_ms` (`driverStatistics.ts`), both tested, live via `/drivers/:id/stats`. There is no per-race (single-session) race-pace field in `raceStatistics.ts` — unlike consistency, which does have one. `average_race_pace_ms` pools every racing lap the driver ran and is derived only from races that have lap data; it has no fallback for races without it. In the committed sample/seed data plus Jolpica importer alone, the 2025 pace input is the single Belgian GP sample (`2025_R13`, the only session with lap rows in `database/seed.sql` and `data/sample/`), because Jolpica ingestion writes no laps. Accepted lap submissions can extend that coverage. With that sample alone, it is a one-race pace although `races_entered` counts every race |
| Consistency | Done and verified | `lapConsistency()` (`lapStatistics.ts`) wired into `classification[].consistency_ms` (`raceStatistics.ts`), tested in both, live via `/races/:id/statistics` (fully derived for `2025_R13`) |
| DNF (per race) | Done and verified | `retirement_count`/`dnf_count` (`raceStatistics.ts`), tested, live via `/races/:id/statistics` |
| Driver points | Done and verified | `points` (`driverStatistics.ts`, tested). Per race session, the stored `race_results.points` is used when a row exists for the driver; `pointsForPosition()` (`pointsTable.ts`, tested in `pointsTable.test.ts`) is used only for a session with no stored row. Live via `/drivers/:id/stats`. The derived scale is the base race scale only — see below for what's excluded |
| Constructor points | Done and verified, live | `buildConstructorStatistics()` (`constructorStatistics.ts`, tested in `constructorStatistics.test.ts`), exposed as `GET /constructors/:constructor_id/stats?season=` (`constructors.controller.ts`). Sums the season's stored `race_results.points` over the rows whose own `constructor_id` is that constructor, so a driver who changed teams mid-season counts for each team only for the races they scored for |
| DNF rate | Done and verified | `dnf_rate` (`driverStatistics.ts`), tested, live via `/drivers/:id/stats` |
| Qualifying-vs-race performance | Done and verified | Implemented as `positions_gained_lost_avg` (`driverStatistics.ts`), tested against real sample data (PIA/NOR/LEC), hand-constructed cases and the ingested-grid fallback in `driverStatistics.test.ts`. `drivers.controller.ts` attaches each race's QUALIFYING events and each driver's `race_results.grid_position`, so over HTTP the grid comes from qualifying events when they exist and from the stored `grid_position` otherwise (a stored `0`, a pit-lane start, is skipped). The Jolpica ingestion does create a QUALIFYING session and `qualifying_results` rows per race, but writes no events for that session, so real ingested races have no qualifying events and the stored `grid_position` is the live source. `qualifying_results` is served only by `GET /races/:grand_prix_id/qualifying` and does not feed this statistic |

**Not implemented at all:**
- **Fastest-lap bonus point.** No scale for it is documented anywhere in this file or `api-design.md`.
- **Sprint aggregation.** The importer can store published sprint points, but driver/constructor statistics and chat standings select only `RACE` sessions; no derived sprint scale or combined championship total is implemented.
- **Safety-car-aware race pace/consistency.** No `is_under_safety_car` flag exists on `LAP_COMPLETED` in the event schema.
- **Penalty-adjusted classification.** `PENALTY_ISSUED` is a defined event type (`event.types.ts`), but no service reads it.

**Sample-data trust boundaries** (issue #55 tracks expanding coverage further). These describe the repository's sample fixtures; runtime read models query SQL, and accepted submissions or ingestion may add data:
- **PIA, NOR, LEC** — sampled laps include their race finish and a qualifying grid entry each, but not every lap of the race. Finishing positions are sourced; pace and consistency use illustrative intermediate times and therefore demonstrate the calculation rather than actual race timing. LEC's grid position is an unconfirmed placeholder (`"source": "illustrative"` in `events.json`), so his `positions_gained_lost_avg` is also illustrative. Stored published points take precedence when available.
- **VER, RUS, ALB, HAM, LAW, BOR, GAS** — one recorded lap each (lap 44, their real classification position from `session_result.classification`). Finishing position and points are trustworthy for these seven — that one lap genuinely is their finish, unlike ANT below. Pace and consistency are **not** trustworthy: the lap time itself is an illustrative placeholder (`"source": "illustrative"`), and a single lap makes `consistency_ms` come back `0` by construction rather than a real measure of spread. None have a qualifying event, so `positions_gained_lost_avg` correctly stays `null` for all seven.
- **ANT** — only one recorded lap (32), a mid-race snapshot rather than his finish — the opposite situation to the seven drivers above (his lap time is real, but his position isn't his finish). His points and `average_finish_position` reflect that mid-race position, not his real result. He has no qualifying event either, so `positions_gained_lost_avg` correctly stays `null`.
- **Everyone else** (every other driver/race outside the Belgian GP) — zero lap/event data in the sample fixtures. A SQL season loaded by ingestion nevertheless has published classifications, pit stops and retirements, so its runtime statistics need not return the fixtures' "no data" shape.

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
| Finishing position | `position` on the driver's highest-numbered recorded lap, without a validity filter. Driver season stats fall back to the classified stored position when no lap position is available; retirement events do not supply a finishing position |
| Positions gained/lost | Starting grid position minus finishing position. The grid is the qualifying session's `LAP_COMPLETED` position when such events exist, otherwise the stored `race_results.grid_position` (see "Fallback to ingested `race_results`") |
| Fastest lap | `min(lap_time_ms)` where `is_valid = true` and `is_pit_lap = false`, across all `LAP_COMPLETED` events in the session |
| Race pace | `average(lap_time_ms)` where `is_valid = true` and `is_pit_lap = false` — pit laps are excluded because they're artificially slow |
| Consistency | `stddev(lap_time_ms)` over the same filtered set used for race pace — lower stddev = more consistent |
| DNF (per race) | `true` if a `RETIREMENT` event exists for that driver in that session |

## 3. Per-season (aggregated)

| Statistic | Formula |
|---|---|
| Driver points | `sum(points)` across all race sessions in the season: the stored `race_results.points` where a row exists, otherwise `pointsForPosition()` of the derived finishing position |
| Constructor points | `sum(race_results.points)` over the season's race rows whose own `constructor_id` is that constructor (per-row attribution, not "both registered drivers") |
| DNF rate | `count(sessions with RETIREMENT for this driver) / count(sessions entered)` |
| Qualifying-vs-race performance | `average(starting grid position − race finishing position)` (`positions_gained_lost_avg`) across the season's races with both positions; qualifying events take precedence over stored grid position. Positive means places gained |

### Fallback to ingested `race_results` (driver stats only)

The Jolpica ingestion pipeline writes a classification per race but no lap log ([Jolpica ingestion](ingestion/jolpica-ingestion.md) §9), so a purely lap-derived `/drivers/:id/stats` would report 0 wins and podiums and a null average finish for those races. `driverStatistics.ts` uses published result facts when no lap-derived position is available (including a recorded lap with a null position). A non-null lap-derived position takes precedence.

| Statistic | Derived first | Falls back to, when there is no derived value |
|---|---|---|
| Finishing position (feeds `wins`, `podiums`, `average_finish_position`) | Position on the driver's last recorded lap | `race_results.position`, the raw nullable column. An unclassified driver (retired, disqualified, did not start) has NULL and contributes no finish |
| Starting grid (feeds `positions_gained_lost_avg`) | Position in the QUALIFYING session's `LAP_COMPLETED` events, when the grand prix has such events | `race_results.grid_position`. `0` (a pit-lane start) is skipped, never guessed at. Real ingested races have no qualifying events (the ingestion writes `qualifying_results` rows, not events), so for them this fallback is the live source |
| `fastest_laps` | Quickest racing lap across all drivers' laps in the session | `race_results.fastest_lap_rank = 1`, only when **no** driver has any laps in the session |
| `points` | Not a fallback: `race_results.points` is *preferred* when a row exists, and the derived scale covers a session with no row | n/a |

`average_race_pace_ms` has no such fallback: it needs lap times, so it stays null for an ingested race.

### Points-per-position table

When a race session has no stored `race_results` row for the driver, `points` above falls back to `pointsForPosition(finishing_position)` for that session, using the base F1 scale:

| Position | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11+ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Points | 25 | 18 | 15 | 12 | 10 | 8 | 6 | 4 | 2 | 1 | 0 |

Constructor points are the sum of the stored `race_results.points` rows scored for that constructor in the season's `RACE` sessions (`constructorStatistics.ts`) — not a separately-scored total, and not a composition of the driver totals. The stored source value applies the scoring rule for that session; stored sprint rows are not selected by this total.

**Not yet computed, because no scale is defined for them:**
- **Fastest-lap bonus point in the derived fallback.** `pointsForPosition()` adds no bonus. A stored published result's points are used unchanged, with the source's applicable scoring rules.
- **Sprint session points.** The derived scale does not implement them, and season statistics do not select sprint sessions.

**Sample-data coverage.** All 10 drivers classified in `session_result.classification` (PIA, NOR, LEC, VER, RUS, ALB, HAM, LAW, BOR, GAS) now have a real, sourced finishing position in the event/lap log, so points are trustworthy for all 10 (issue #55). ANT is the one exception: his only recorded lap (32) is a mid-race snapshot, not his finish, so his points reflect that mid-race position rather than his real result. See the "Sample-data trust boundaries" list above for the pace/consistency caveat that still applies to the 7 most recently added drivers.

### Positions gained/lost — sign convention

There is one field for both catalogue entries, `positions_gained_lost_avg`: `grid − finish`, positive = gained places. An earlier design used the opposite sign for qualifying-vs-race performance; the table above now follows the actual response. There is no separately exposed inverse measure.

**Precedence.** When both exist for a race, the qualifying events' position wins over the stored `race_results.grid_position`. Real ingested races have no qualifying events, so the stored grid is what the live API uses for them. The published qualifying classification (`qualifying_results`, ingested from Jolpica) is exposed separately by `GET /races/:grand_prix_id/qualifying` and is not an input to any statistic.

**Sample-data coverage.** `data/sample/events.json` now includes a minimal `2025_R13_QUALIFYING` session (`evt_011`-`evt_013`): one `LAP_COMPLETED` event per driver, position-only, for PIA, NOR and LEC — the same three drivers whose race finishing position is trustworthy (see above). NOR's pole position and PIA's P2 grid slot are corroborated by existing data (`session_result.pole_position`, and `evt_004`'s `position_before` with no earlier `POSITION_CHANGE`) and marked `"source": "real"`. LEC's grid position is an unconfirmed placeholder marked `"source": "illustrative"` — replace it with the real qualifying classification (Jolpica/ESPN) before treating it as fact. See issue #55.

## 4. Notes on edge cases

- **Sprint sessions** have separate stored `race_results` when ingestion opts in, with points supplied by Jolpica. The current season statistics/standings omit them; exports preserve their separate session type.
- **Safety car / red flag periods** distort lap times significantly. A future iteration of this schema could add an `is_under_safety_car` flag to `LAP_COMPLETED` so race-pace/consistency calculations can exclude those laps too — out of scope for the Sprint 1 sample data, but worth flagging for Member 2/4 as the schema evolves.
- **Penalties** applied after a session (e.g. a post-race time penalty) mean the finishing order derived purely from `LAP_COMPLETED` events may need adjusting by any `PENALTY_ISSUED` events before the final `RaceResult` classification is correct.

## 5. External data sources

- **[Jolpica-F1](https://api.jolpi.ca/ergast/f1/)** — open-source, actively maintained successor to the now-shut-down Ergast API. Same JSON response shape as Ergast. Used for season schedules, driver/constructor rosters, and race classifications. Covers 1950 to the current season.
- **[OpenF1](https://openf1.org)** — the current separate importer reads overtakes and lap-start timestamps to populate `position_changes`; it does not persist lap timing or pit-stop data. See [OpenF1 position-change ingestion](ingestion/openf1-overtakes.md).

**Why two sources:** no single free API covers both season-level structure (schedule, results, standings) and session-level granularity (lap times, pit stop timing) well. Jolpica is the right shape for the "static" entities (Season, GrandPrix, Driver, Constructor, RaceResult); OpenF1 is the right shape for the event log itself.

## 6. Sample implementation

`data/sample/events.json` and `data/sample/laps.json` demonstrate a subset of these statistics computed against real 2025 Belgian Grand Prix data. See the `_note` and `source` fields in those files for which values are confirmed real race facts vs. illustrative placeholders.

## 7. Standings and disqualifications in the chat assistant

These are internal read-only chat tools, not standalone standings/disqualification routes. Driver standings reuse the same season inputs and `buildDriverStatistics` as `/drivers/:id/stats`, loaded in a fixed number of queries. They include drivers with a `RACE` result or lap, and use the constructor on the latest race result for team display. Team-driver lists instead count each driver's race results for the requested team, preserving mid-season transfers.

`get_driver_standings` sorts by points, wins, podiums, fastest laps, DNFs or average finish. Nulls sort last, average finish ascending and the other statistics descending. Equal values share competition ranks (`1, 2, 2, 4`), with points then driver ID determining display order. A separate `points_position` and full-field points/wins leaders keep rank meanings explicit. Constructor standings group published Grand Prix points per result row; ties share a rank and display by constructor ID. Neither table implements official championship countback.

Disqualifications count race-result rows whose stored `status` is `DSQ`; they are separate from `dnf_count`, which counts retirement events. A DNS maps to a stored DNF status but creates no retirement event, so it does not increment this statistic. A classified retirement with a numeric stored position can still contribute to average finish/wins/podium calculations; only a null classified position is omitted. Disqualifications are added by the chat driver tool and DNF-sorted standings, not by the public driver-statistics response.

`get_race_events` reports recorded pit stops, penalties or position changes, with up to eight examples from the first 500 events and a public list link. `overtake_count` counts `POSITION_CHANGE` events, including imported position exchanges that may be caused by stops/penalties; it is not a verified count of on-track passes. The chat race-summary tool labels lap-derived classification availability using `lap_data_available`; this does not prove that its lap log is complete. See [API Design](api-design.md) for tool and cache limits.


---
*This document was edited with the assistance of: Claude-Web[Claude Sonnet 5], Claude-Code[Claude Sonnet 5]*
