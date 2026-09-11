# Jolpica-F1 Ingestion Pipeline

How season data gets from the [Jolpica-F1 API](https://api.jolpi.ca/ergast/f1/) into
`database/schema.sql`, and every decision the mapping makes that is not a straight field
copy.

```
npm run ingest -- --season 2025
```

---

## 1. Command

Run from the repo root (delegates into `src/backend`) or from `src/backend` directly.

| Flag | Effect |
|---|---|
| `--season <year>` | **Required.** Four-digit season, e.g. `2025`. |
| `--include-sprints` | Also ingest `SPRINT` sessions and their points. Off by default. |
| `--dry-run` | Fetch, map and print the plan. Writes nothing, needs no `DATABASE_URL`. |
| `--refresh` | Ignore cached responses for this run, then repopulate the cache. |
| `--cache-dir <path>` | Override the response cache location. |
| `--help` | Usage. |

Writing requires `DATABASE_URL`. `--dry-run` deliberately does not, so the mapping can be
inspected without database access.

A full 2025 run:

```
circuits                 24
grand_prix               24
sessions                 24     (30 with --include-sprints)
drivers                  21
constructors             10
driver_constructor_links 21
race_results             479    (599 with --include-sprints)
pit_stops                821
retirements              51
```

Pit stops and retirements are unaffected by `--include-sprints`: both are derived from
`RACE` sessions only.

---

## 2. Layout

| File | Responsibility |
|---|---|
| `src/ingestion/jolpica.types.ts` | Zod schemas for the Ergast envelope. All parsing, no casts. |
| `src/ingestion/rateLimiter.ts` | Rolling-window limiter + `Retry-After` parsing. |
| `src/ingestion/httpCache.ts` | On-disk response cache. |
| `src/ingestion/jolpicaClient.ts` | HTTP: pagination, caching, rate limiting, retries. |
| `src/ingestion/transform.ts` | **Pure.** Jolpica objects → database rows. No I/O. |
| `src/ingestion/ingestSeason.ts` | Idempotent upserts inside one transaction. |
| `src/ingestion/cli.ts` | Argument parsing and run sequence. |
| `src/scripts/ingest.ts` | Process entry point. |

`transform.ts` is pure and holds every mapping decision, so the whole mapping is testable
without a network or a database. All I/O is confined to `jolpicaClient.ts` and
`ingestSeason.ts`.

---

## 3. API behaviour

Verified against `api.jolpi.ca` for season 2025 on 2026-09-11.

- **Pagination is `limit`/`offset`, and `limit` silently caps at 100.** Requesting 200
  returns 100 rows with `MRData.limit: "100"` and no error. The page loop therefore
  advances by the limit the *server* reports, never the one requested — trusting the
  request would skip 100 rows per page.
- **`MRData.total` is the row count, not the race count.** A single page of results holds
  many races; `total` is the only reliable termination signal.
- 2025 holds **479 race results** across 24 rounds (5 pages) and **120 sprint results**
  across 6 sprint weekends (2 pages).
- **The pit-stops endpoint requires a round.** A season-wide `/2025/pitstops/` request
  returns HTTP 400; only `/2025/{round}/pitstops/` works. The client therefore issues one
  request per round, sequentially, through the same rate limiter. No 2025 round exceeds
  one page of stops.
- **Every scalar is a string**, including numbers. `points` is the only genuinely
  fractional field in a result row (half points for a shortened race); pit-stop
  `duration` is decimal seconds as a string, e.g. `"23.213"`.
- **Statuses are normalised** to five strings for 2025: `Finished`, `Lapped`, `Retired`,
  `Disqualified`, `Did not start`. The classic Ergast spellings (`+1 Lap`, `Accident`,
  `Engine`) are still handled, because older seasons emit them.
- **`Time.millis` is absolute elapsed race time**, not a gap, for every classified
  finisher. Ergast renders it as `+0.895` for display, but the field is total time.
- **`FastestLap.Time.time` is a formatted string** (`"1:22.167"`), not milliseconds.
- A sprint weekend is marked in the calendar by a `Sprint` block on the race entry.
- Responses carry `cache-control: max-age=600`.

A races-only 2025 run costs **30 requests**: 5 results pages, 1 calendar page, and 24
per-round pit-stop pages. `--include-sprints` adds 2 more.

---

## 4. Mapping decisions

### 4.1 `grand_prix_id` is zero-padded

`{season}_R{round}` with the round **padded to two digits** — `2025_R01`, not `2025_R1`.
Round 13 is `2025_R13` either way; only rounds 1–9 differ.

The reason is that the identifiers already exist. The hosted Neon database and
`database/seed.sql` both store the padded form, so an ingest emitting `2025_R1` would not
update the existing row for round 1 — it would insert a **second** grand prix beside it,
and every session, result and pit stop hanging off it would attach to the wrong one. Nine
of twenty-four races would silently double.

The rule lives in exactly one place, `src/utils/identifiers.ts`, which both the
sample-data helpers and the ingestion import, so the API and the database cannot drift
apart on how a race is named.

> An earlier revision of this pipeline used the unpadded form and changed `seed.sql` to
> match. That was reversed: rewriting identifiers that production data already uses is a
> migration, not a convention change, and the padded form was the one already in the
> ground.

### 4.2 Points come from Jolpica, not from derivation

`race_results.points` is written straight from the source. The scoring rules vary by era,
by sprint, and by shortened race distance (half points), and Jolpica already applies the
correct rule per row.

This is a deliberate exception to "statistics are derived" in `src/backend/CLAUDE.md`:
points on a classification row are not a derived statistic, they are a published fact
about that classification, in the same category as the finishing position beside them.

Note that `services/pointsTable.ts` now encodes the base P1–P10 race scale, but it serves
the **derived statistics** endpoint (`/drivers/{id}/stats`), not this pipeline. It
deliberately implements neither the sprint scale nor the fastest-lap bonus, because
neither is documented — which is precisely why the ingest still takes `race_results.points`
from the source rather than computing it.

`gap_to_winner_ms` follows the same reasoning as points — it is computed as a subtraction
against the winner's absolute time, because the lap-by-lap log needed to derive it does not
exist for these races.

### 4.3 `race_results.grid_position`

Added by `database/migrations/004_grid_position.sql` and declared in `schema.sql`.
Nullable, `CHECK (grid_position IS NULL OR grid_position >= 0)`.

**0 is a pit-lane start — a real value, not a missing one.** NULL means "not recorded". A
`> 0` check would reject a legitimate pit-lane start. (2025 happens to contain no grid-0
rows, but the constraint has to be right regardless.)

This column was added for `positions_gained_lost_avg`. That statistic is now implemented,
but it derives the starting grid from **QUALIFYING session events** rather than from this
column, so nothing currently reads `grid_position` — see §9.

### 4.4 Mid-season constructor changes resolve to the most recent team

`driver_constructor_links` is keyed `(season, driver, constructor)`, so a driver who
changes team mid-season could hold two rows. Consumers do not expect that —
`models/drivers.model.ts` and the frontend both read a driver's team as a single value, and
two rows would make it non-deterministic.

A driver is therefore linked to the team of the **highest round they appear in**, counting
sprint rounds when those are ingested. For 2025 this yields Tsunoda at Red Bull, Lawson at
RB, and both Doohan and Colapinto at Alpine — matching what `seed.sql` records by hand.

`race_results.constructor_id` is **not** affected: it stays the team the driver actually
drove for in that specific race.

The writer `DELETE`s any other link for that driver and season before inserting. Without
that, a re-run after a transfer would leave the old team's row behind forever, since the
primary key includes `constructor_id`.

### 4.5 "Did not start" folds into DNF

`result_status` has three members: `FINISHED`, `DNF`, `DSQ`. A DNS becomes `DNF`.

Adding a fourth member would require a migration on a shared enum plus a matching change
everywhere DNF is counted. A DNS is a non-finish, and treating it as one keeps "DNF rate"
meaning *races entered but not finished*.

Full status mapping:

| Jolpica status | `result_status` |
|---|---|
| `Finished` | `FINISHED` |
| `Lapped`, `+1 Lap`, `+N Laps` | `FINISHED` — a driver two laps down still finished and is ranked |
| `Disqualified` | `DSQ` |
| `Did not start`, `Did not qualify` | `DNF` |
| everything else (`Retired`, `Accident`, `Engine`, …) | `DNF` |

**The explicit status wins over the displayed classification number.** Jolpica can report a
retirement that still carries a numeric `positionText`, because a driver who completed
enough of the race distance is classified even though they did not finish. Those rows are
`DNF` *and* keep their position. 2025 has five of them — Norris at rounds 10 and 15, Sainz
at round 20, Stroll and Hadjar at round 23.

For 2025 this gives 419 `FINISHED`, 54 `DNF` and 6 `DSQ` across the 479 race rows
(527 / 66 / 6 across 599 rows with `--include-sprints`).

### 4.6 Entity identifiers are mapped, not adopted

Jolpica uses slugs (`max_verstappen`, `mclaren`); this repo uses short codes (`VER`,
`MCL`) in `seed.sql`, the seeded database and the frontend.

- **Drivers** use `Driver.code`. The schema settles it: `driver_id` is `VARCHAR(10)` and
  `max_verstappen` is 14 characters. All 479 result rows of 2025 carry a code; the slug
  fallback exists only for reserve drivers, who never start a race.
- **Constructors** are mapped through an explicit table. `VARCHAR(20)` would *accept*
  `mclaren`, but ingesting it alongside the seeded `MCL` would create a duplicate row per
  team and split `race_results` foreign keys across both. The 2025 grid maps 1:1 onto the
  ten seeded codes. An unknown constructor falls back to a truncated uppercase slug rather
  than aborting the run.

Constructor **display names** keep this project's spelling ("Red Bull Racing", "Alpine",
"Kick Sauber") over Jolpica's ("Red Bull", "Alpine F1 Team", "Sauber"), so the UI does not
change under a data refresh.

If two Jolpica drivers ever collapse onto one code, the plan emits a warning rather than
silently overwriting a row.

The pit-stops endpoint identifies drivers by **slug only** — it carries no `code` — so the
mapping is reused via a slug→code table built while the result rows are walked. A stop
whose slug was never seen in a result row is skipped with a warning rather than dropped
silently. 2025 produces no such warnings.

### 4.7 Fastest laps

`race_results` carries `fastest_lap_rank`, `fastest_lap_number` and `fastest_lap_time_ms`,
added by `database/migrations/005_race_result_fastest_lap.sql`. They exist so race
statistics can report a fastest lap for a race whose lap-by-lap telemetry has never been
ingested.

`FastestLap.Time.time` is a formatted string, so it is parsed to milliseconds
(`"1:22.167"` → `82167`). A row with no `FastestLap` block leaves all three columns NULL;
457 of the 479 2025 race rows carry one.

`models/raceResults.model.ts` reads the row with `fastest_lap_rank = 1` as the session's
fastest lap. The statistics endpoint prefers a lap-derived value and uses this stored one
only as a fallback.

### 4.8 Other field choices

- **`permanent_number`** comes from the per-result `number`, not `Driver.permanentNumber`.
  Jolpica rewrites the latter when a champion takes #1 — it reports Norris as 1 and
  Verstappen as 3 for 2025, the reverse of what they actually raced. The per-result number
  is what was carried that season, and what `seed.sql` records.
- **`position`** is NULL unless `positionText` is numeric. Ergast populates `position` even
  for retirements as an ordering; storing it would make an unclassified DNF count as a
  podium. 2025 has 55 NULL positions across the 479 race rows. That is deliberately *not*
  the same as the DNF+DSQ count of 60 — the five classified retirements in §4.5 are DNF
  but keep a position.
- **`sessions.total_laps`** is the winner's lap count, i.e. the distance actually run.

---

## 5. Pit stops and retirements

Both are event-table rows, not classification columns, and both are rebuilt on every run.

**Pit stops** come from `/{season}/{round}/pitstops/`. Durations are decimal seconds and
are rounded to whole milliseconds; a missing or non-positive duration stores NULL rather
than a fabricated zero. 2025 yields 821 stops, one of which has no duration.

**Retirements** are derived from the race results themselves — a row whose status is
neither a finish, nor a DSQ, nor a DNS is a retirement, and its status string becomes the
`reason`. `laps` becomes the retirement lap. 2025 yields 51, all with reason `Retired`.
Note this count is deliberately smaller than the 54 `DNF` results: a DNS is a `DNF`
classification but not a retirement, so it produces no `retirements` row.

**Approved submissions are never destroyed.** Both tables are cleared per race session
before reinsertion, but only `WHERE submission_id IS NULL` — reviewed, human-submitted
rows survive. A source pit stop is skipped entirely when an approved submission already
describes the same `(session, driver, lap)`, so the two cannot double-count. The
retirement upsert likewise refuses to overwrite a row that carries a `submission_id`.

Clearing before reinsertion is what lets an upstream correction *remove* a row: a plain
upsert could only ever add or update.

---

## 6. Idempotency

Every classification statement is an upsert on the primary key the schema already declares,
and a season lands in **one transaction** — a failure rolls the whole season back.

Running the same season twice produces the same rows and the same counts. Running it after
a `schema.sql` + `seed.sql` bootstrap updates the seeded rows in place rather than
duplicating them.

Places that need more than a plain upsert:

- **`driver_constructor_links`** — stale links are deleted first (§4.4).
- **`pit_stops` and `retirements`** — source rows are deleted and rebuilt per race session,
  preserving submission-backed rows (§5).
- **`race_results`** — `gap_to_winner_ms` and the three `fastest_lap_*` columns use
  `COALESCE(EXCLUDED.…, race_results.…)`, so an existing value survives a later run whose
  source happens to omit it.
- **`race_results.pit_stops`** is not written by the result upsert. It is recomputed at the
  end of the run as a `COUNT(*)` over the `pit_stops` table for that session, so the
  denormalised count always matches the event rows — including stops that arrived via an
  approved submission rather than from Jolpica.

---

## 7. Caching and rate limiting

**Cache.** Responses are stored as JSON on disk under the system temp directory
(override with `--cache-dir`), keyed by a hash of the full URL, with a 6-hour TTL. Entries
are written temp-then-rename, so an interrupted run cannot leave a half-written file that
still parses. A corrupt or URL-mismatched entry is treated as a miss, never as an error.
**A cache hit costs no rate-limit budget** — that is the point, and it matters more now
that a races-only run is 30 requests rather than 6.

**Rate limiting.** Two rolling-window limiters in series, matching Jolpica's published
unauthenticated allowances with headroom: 3 requests/second (published 4) and 450/hour
(published 500). A rolling rather than fixed window, so a burst at the end of one window
plus a burst at the start of the next cannot exceed the rate. Acquisition is serialised, so
concurrent callers cannot both claim the same slot. The per-round pit-stop requests are
issued sequentially through this same limiter.

**Retries.** 429 and 5xx are retried with exponential backoff (0.5s, 1s, 2s, 4s, capped at
30s), honouring `Retry-After` when present as either a delay or an HTTP date. Other 4xx
responses fail immediately — retrying a 404 only burns budget. A failed request is never
cached.

---

## 8. Tests

112 tests across six files in `src/backend/src/ingestion/`, none of which touch the network
or a database:

| File | Covers |
|---|---|
| `transform.test.ts` | Every decision in §4–5, against wire-format fixtures parsed through the real schemas |
| `jolpicaClient.test.ts` | Pagination (including the silent 100 cap), caching, retries, rate-limit ordering, per-round pit-stop fetching |
| `rateLimiter.test.ts` | Window behaviour under concurrency, `Retry-After` parsing |
| `httpCache.test.ts` | TTL, corruption, URL mismatch, temp-file cleanup |
| `ingestSeason.test.ts` | Upsert shape, FK write order, idempotency, submission preservation, rollback |
| `cli.test.ts` | Argument parsing, sprint opt-in, dry-run writing nothing |

Fixtures are written in the wire format — every scalar a string — and parsed through the
production Zod schemas, so a test cannot assert against a shape the API never sends.

---

## 9. Limits

- **No lap-by-lap log.** Jolpica's results endpoints carry no per-lap telemetry, so `laps`,
  `position_changes` and `penalties` are still untouched by this pipeline. The derivation
  engine has nothing per-lap to work from for an ingested race, which is why
  `race_results.fastest_lap_*` exists as a fallback (§4.7).
- **`grid_position` is written but never read.** It was added for
  `positions_gained_lost_avg`, which now takes its starting grid from QUALIFYING events
  instead. The column is correct and populated; no consumer uses it yet.
- **Qualifying is not ingested.** Nothing in this pipeline writes a QUALIFYING session, so
  the qualifying events that `positions_gained_lost_avg` needs come only from sample data.
- **Sprints are opt-in.** Without `--include-sprints`, any points total derived from
  `race_results` undercounts a sprint season. `grand_prix.has_sprint` is still set
  correctly either way, from the calendar.
