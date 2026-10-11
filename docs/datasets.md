# Datasets

The API can export whole datasets as **CSV** or **JSON** for use in
spreadsheets, pandas, R or any other analysis tool. Exports are public (no
sign-in) and unpaginated: one request returns every row that matches.

```
GET /api/v1/export/{dataset}?format=csv|json&season=YYYY
```

| Parameter | Values | Notes |
|---|---|---|
| `dataset` | `races`, `drivers`, `constructors`, `results`, `laps` | Anything else returns `400 VALIDATION_ERROR`. |
| `format` | `csv`, `json` | Optional, defaults to `json`. Lowercase only. |
| `season` | four-digit year, e.g. `2025` | **Required** for `results` and `laps`. Optional filter for the other three. |

Both formats download as a file named `f1-<dataset>-<season>.<format>`
(`all` in place of the season when none is given). CSV files have a header
row, use RFC 4180 quoting, and write missing values as empty fields. JSON
responses look like:

```json
{
  "data": [ ... ],
  "meta": {
    "dataset": "results",
    "season": "2025",
    "row_count": 479,
    "generated_at": "2026-09-28T12:00:00.000Z"
  }
}
```

Rows are source records as loaded from Jolpica-F1 and approved submissions —
nothing in an export is an aggregated statistic. For derived figures (wins,
podiums, averages) use the `/stats` and `/statistics` endpoints instead.

The full request/response contract is in the OpenAPI spec
(`docs/api/openapi.yaml`, served at `/api/docs`).

## Production and Test Data

Production read models use data loaded into PostgreSQL. Jolpica ingestion
provides published calendars, classifications, results, points, grids, fastest
laps, qualifying results and related race data. OpenF1 ingestion separately
provides position-change/overtake events.

`data/sample/` contains development fixtures, including Belgian Grand Prix
event and lap samples. `database/seed.sql` loads the development sample into a
fresh database; automated tests also use dedicated fixtures. CI creates
disposable PostgreSQL databases for schema validation and integration tests.
These samples and test databases support development and validation; they are
not a runtime fallback when the production database is unavailable.

## Available datasets

### `races`

One row per grand prix, newest season first, then by round.

| Column | Meaning |
|---|---|
| `grand_prix_id` | `{season}_R{round}`, round zero-padded — e.g. `2025_R08`. |
| `season_id` | Season, e.g. `2025`. |
| `round` | Round number within the season. |
| `race_name` | Official event name. |
| `circuit_id` | Circuit identifier, e.g. `spa`. |
| `circuit_name` | Circuit name. |
| `locality` | Town or city. |
| `country` | Host country. |
| `date` | Race day, `YYYY-MM-DD`. |
| `has_sprint` | `true` if the weekend includes a sprint. |
| `has_results` | `true` once a race classification has been loaded. |

### `drivers`

One row per driver, ordered by `driver_id`. With `season`, only drivers who
raced for a team that season, shown with that season's team. Without it,
every driver with their most recent team.

| Column | Meaning |
|---|---|
| `driver_id` | Three-letter code, e.g. `PIA`. |
| `permanent_number` | Car number. |
| `given_name`, `family_name` | Driver's name. |
| `nationality` | Nationality. |
| `date_of_birth` | `YYYY-MM-DD`. |
| `constructor_id` | Team code, e.g. `MCL`. |
| `constructor_name` | Team name. |

### `constructors`

One row per team, ordered by `constructor_id`. With `season`, only teams
that took part that season.

| Column | Meaning |
|---|---|
| `constructor_id` | Team code, e.g. `MCL`. |
| `name` | Team name. |
| `nationality` | Team nationality (may be empty). |

### `results` — season required

One row per driver per classified session (race and sprint), ordered by
round, session, then finishing position.

| Column | Meaning |
|---|---|
| `season_id`, `round`, `grand_prix_id`, `race_name` | Which grand prix. |
| `session_id` | e.g. `2025_R13_RACE`. |
| `session_type` | `RACE` or `SPRINT`. |
| `position` | Finishing position; empty if unclassified. |
| `driver_id`, `constructor_id` | Driver and the team they drove for **in that session**. |
| `grid_position` | Starting position; `0` means a pit-lane start. |
| `laps_completed` | Laps completed. |
| `pit_stops` | Number of pit stops. |
| `status` | `FINISHED`, `DNF` or `DSQ`. |
| `points` | Points awarded for that session, as published. |
| `gap_to_winner_ms` | Gap to the winner in milliseconds; `0` for the winner, empty when no time gap is recorded (e.g. lapped or retired). |
| `fastest_lap_rank` | Rank of the driver's fastest lap in the session (`1` = fastest lap of the race). |
| `fastest_lap_number` | Lap on which that fastest lap was set. |
| `fastest_lap_time_ms` | That lap's time in milliseconds. |

### `laps` — season required

One row per driver per lap for every session with a loaded lap log, ordered
by round, session, driver, then lap.

| Column | Meaning |
|---|---|
| `season_id`, `round`, `grand_prix_id` | Which grand prix. |
| `session_id`, `session_type` | Which session. |
| `driver_id` | Driver. |
| `lap_number` | Lap number, from 1. |
| `lap_time_ms` | Lap time in milliseconds; empty if not recorded. |
| `position` | Running position at the end of the lap. |
| `is_pit_lap` | `true` if the driver pitted on this lap. |
| `is_valid` | `false` if the lap time was deleted (e.g. track limits). |

Lap coverage depends on what has been ingested, so a season can have results
for every round but laps for only some of them.

## Examples

Download the 2025 results as CSV with curl:

```bash
curl -OJ "https://f1-sport-analytics-api-production.up.railway.app/api/v1/export/results?season=2025&format=csv"
```

`-OJ` saves the file under the server-supplied name,
`f1-results-2025.csv`. Against a local server, use
`http://localhost:3001/api/v1` as the base instead.

Load it straight into pandas:

```python
import pandas as pd

df = pd.read_csv("https://f1-sport-analytics-api-production.up.railway.app/api/v1/export/results?season=2025&format=csv")
```

## Errors

Invalid requests return `400` with the standard error envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameter 'season': required for the 'results' dataset"
  }
}
```
