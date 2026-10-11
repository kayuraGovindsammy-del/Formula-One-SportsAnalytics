# API Design

*Member 2 — Backend API & Derivation Engine*

This document is the contract for the backend API. It exists so that:

- **Member 3** (frontend) knows exactly what to fetch and what shape comes back.
- **Member 4** knows exactly what the backend expects from them.
- The submission pages share the same validated event contract as the database and statistics engine.

It reflects the entities in [`data-model.md`](data-model.md), the event log in [`event-schema.md`](event-schema.md), the formulas in [`f1-statistics.md`](f1-statistics.md), the tables in `schema.sql`, and the actual read shapes the frontend already consumes via `f1Data.ts`.

The current backend uses PostgreSQL read models, reviewed SQL submissions, dataset exports and a public chat assistant. Of the identity and admin endpoints in §8, only `DELETE /users/me` is mounted; profiles and submitter requests still use Firestore. [`openapi.yaml`](api/openapi.yaml) describes the mounted routes and is served publicly at `/api/openapi.yaml` and `/api/openapi.json`, with Swagger UI at `/api/docs`.

---

## 1. Base URL and versioning

```
/api/v1/...
```

All routes are versioned from day one under `/api/v1`. Breaking changes to a resource's shape get a new version prefix (`/api/v2/...`) rather than mutating `/v1` in place — existing frontend code should never break out from under it without a version bump.

---

## 2. Response envelope

Successful JSON responses use:

```json
{
  "data": ...,
  "meta": { ... }
}
```

`data` is a single object for detail endpoints, an array for list endpoints. `meta` is `{}` for single-resource responses and carries pagination info for list responses (§5).

Every error response, at the matching HTTP status:

```json
{
  "error": {
    "code": "MACHINE_READABLE",
    "message": "human readable"
  }
}
```

JSON resource responses never mix `data` and `error`. Exceptions to the JSON envelope are CSV attachments (§4.12), completed account deletion (`204`, no body), and the API documentation downloads.

### Error codes

| Code | HTTP status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request body or query params failed validation (bad type, missing required field, out-of-range value). |
| `UNAUTHENTICATED` | 401 | No `Authorization` header, or the bearer token is missing/expired/invalid. |
| `FORBIDDEN` | 403 | Authenticated, but the caller's role doesn't permit this action (e.g. a `USER` calling a submitter-only endpoint). |
| `NOT_FOUND` | 404 | The requested resource (driver, race, session, submission, user) doesn't exist. |
| `DUPLICATE_EVENT` / `SUBMISSION_ALREADY_REVIEWED` | 409 | Event ID/publication conflict or attempted repeat review. |
| `RATE_LIMITED` | 429 | Caller exceeded the request rate limit. |
| `INTERNAL_ERROR` | 500 | Unhandled server-side failure. Message is generic; details go to server logs, not the response. |
| `BAD_GATEWAY` | 502 | The configured chat providers failed to produce a response. |
| `SERVICE_UNAVAILABLE` | 503 | The chat assistant has no configured provider key. |

Sprint-2-specific codes are listed in §7–8 where they apply.

---

## 3. Field naming

**snake_case end to end. No camelCase transformation at the API boundary.**

Every field name in every request and response body matches `schema.sql` and `data/sample/*.json` exactly: `driver_id`, `lap_time_ms`, `is_pit_lap`, `submitted_by`, and so on. The backend does not rename fields for the frontend's convenience, and the frontend does not send camelCase and expect the backend to cope.

`f1Data.ts` maps the API's snake_case records into camelCase frontend types (`Driver.driverId`, `Race.hasSprint`, etc.). Firestore profiles retain their separate camelCase fields, such as `submitterStatus`; the SQL-backed submission API uses snake_case.

---

## 4. Read endpoints

Designed directly from what `f1Data.ts` and its consuming pages (`Dashboard.tsx`, `Drivers.tsx`, `Races.tsx`, `DriverDetails.tsx`, `RaceDetails.tsx`) actually need today.

Races are identified by `grand_prix_id` (e.g. `"2025_R13"`), matching `data-model.md` and `schema.sql`, rather than by bare `round`. Rounds 1–9 are zero-padded (`2025_R01`). The frontend `/races/:id` route now uses this identifier.

Driver, constructor and grand-prix path lookups are case-insensitive. Driver/detail/statistics responses use canonical stored IDs; qualifying echoes the supplied grand-prix path string as documented in §4.10.

### 4.1 `GET /api/v1/drivers` — driver list

Backs `Drivers.tsx`. `constructor_name` is resolved server-side via a join against `constructors`. The driver list/detail selects the latest `driver_constructor_links` season, resolving multiple links by `constructor_id`; it is not a historical per-race team lookup.

**Known implementation issue:** a nonempty `constructor_id` filter currently builds a SQL predicate using alias `dcl`, but the query joins the selected link as `cl` (`models/drivers.model.ts`). Source inspection therefore indicates that this filter will fail on PostgreSQL. The route tests use mocked/sample models and do not verify that SQL execution; this audit did not reproduce it against a live database. The unfiltered list and other predicates do not use that alias.

```json
{
  "data": [
    {
      "driver_id": "VER",
      "permanent_number": 1,
      "given_name": "Max",
      "family_name": "Verstappen",
      "nationality": "Dutch",
      "date_of_birth": "1997-09-30",
      "constructor_id": "RBR",
      "constructor_name": "Red Bull Racing"
    }
  ],
  "meta": { "page": 1, "per_page": 20, "total_items": 20, "total_pages": 1 }
}
```

### 4.2 `GET /api/v1/drivers/{driver_id}` — driver detail

Backs `DriverDetails.tsx`. Same shape as one list item.

```json
{
  "data": {
    "driver_id": "PIA",
    "permanent_number": 81,
    "given_name": "Oscar",
    "family_name": "Piastri",
    "nationality": "Australian",
    "date_of_birth": "2001-04-06",
    "constructor_id": "MCL",
    "constructor_name": "McLaren"
  },
  "meta": {}
}
```

404 `NOT_FOUND` if `driver_id` doesn't exist.

### 4.3 `GET /api/v1/drivers/{driver_id}/stats?season=2025`

Backs the driver season-stat cards in `DriverDetails.tsx`, which fetches this endpoint through `fetchDriverStatistics`. Per-season aggregation, computed per the formulas in [`f1-statistics.md`](f1-statistics.md) §3. Consistency belongs to race-classification rows, not this response. Some fields are `null` — see §9 for why.

```json
{
  "data": {
    "driver_id": "PIA",
    "season": "2025",
    "races_entered": 24,
    "wins": 7,
    "podiums": 16,
    "dnf_count": 1,
    "dnf_rate": 0.0417,
    "fastest_laps": 6,
    "average_finish_position": 2.77,
    "average_race_pace_ms": 107417,
    "points": 381,
    "positions_gained_lost_avg": -0.14
  },
  "meta": {}
}
```

These numbers are a 2025 season snapshot of the live API's response for PIA, not fixed values: they change if the underlying data is re-ingested. A negative `positions_gained_lost_avg` means the driver lost places on average from grid to finish (positive means gained).

`points` is the sum over the season's `RACE` sessions of the stored `race_results.points` where a row exists for the driver, falling back to the base P1–P10 scale for a session with no stored row; it is `null` (not `0`) only when neither source produced anything. `SPRINT` sessions are excluded even when ingested, so this is a Grand Prix points total, not the official championship total. `positions_gained_lost_avg` is `null` when no race has both a grid position and a finishing position. A valid season with no data returns `200`, `races_entered: 0` and the no-data nulls/counts, rather than `404`.

**Ingested races.** These fields are derived from lap data, but Jolpica ingestion writes none. When the driver's last recorded lap provides no position (no laps or a null position), `wins`, `podiums` and `average_finish_position` fall back to that session's classified `race_results.position` (NULL means no finish). For `positions_gained_lost_avg` the starting grid is the qualifying session's last `LAP_COMPLETED` position when derivable, otherwise the stored `race_results.grid_position` (`0`, a pit-lane start, is skipped). The ingestion writes a QUALIFYING session and `qualifying_results` rows but no qualifying events, so for ingested races the stored grid is the source unless accepted/sample qualifying events exist; `qualifying_results` is exposed separately by §4.10 and is not an input here. `fastest_laps` credits stored `fastest_lap_rank = 1` only for a session where no driver has laps. A non-null lap-derived position always takes precedence. `average_race_pace_ms` requires timed racing laps. Details: [`f1-statistics.md`](f1-statistics.md) "Fallback to ingested `race_results`".

### 4.4 `GET /api/v1/races` — race list

Backs `Races.tsx`. `has_results` is `true` when the race's `RACE` session has at least one `race_results` row (a session with no stored result rows, or only a QUALIFYING session, gives `false`). It tells the frontend whether the race has published results to show.

```json
{
  "data": [
    {
      "grand_prix_id": "2025_R13",
      "season_id": "2025",
      "round": 13,
      "race_name": "Belgian Grand Prix",
      "circuit_id": "spa",
      "circuit_name": "Circuit de Spa-Francorchamps",
      "locality": "Spa",
      "country": "Belgium",
      "date": "2025-07-27",
      "has_sprint": true,
      "has_results": true
    }
  ],
  "meta": { "page": 1, "per_page": 20, "total_items": 24, "total_pages": 2 }
}
```

### 4.5 `GET /api/v1/races/{grand_prix_id}` — race detail

Backs the header of `RaceDetails.tsx`. Includes the weekend's sessions so the frontend can find the session it needs (e.g. the `RACE` session's `session_id`) without a second round trip.

```json
{
  "data": {
    "grand_prix_id": "2025_R13",
    "season_id": "2025",
    "round": 13,
    "race_name": "Belgian Grand Prix",
    "circuit_id": "spa",
    "circuit_name": "Circuit de Spa-Francorchamps",
    "locality": "Spa",
    "country": "Belgium",
    "date": "2025-07-27",
    "has_sprint": true,
    "sessions": [
      {
        "session_id": "2025_R13_RACE",
        "grand_prix_id": "2025_R13",
        "type": "RACE",
        "total_laps": 44,
        "start_time": "2025-07-27T13:00:00Z",
        "end_time": "2025-07-27T14:30:00Z"
      }
    ]
  },
  "meta": {}
}
```

404 `NOT_FOUND` if `grand_prix_id` doesn't exist.

### 4.6 `GET /api/v1/races/{grand_prix_id}/laps` — laps for a race

Defaults to the `RACE` session (override with `?session_type=`, see §6). Raw `LAP_COMPLETED`-derived rows, matching `laps.json` exactly.

```json
{
  "data": [
    {
      "session_id": "2025_R13_RACE",
      "driver_id": "PIA",
      "lap_number": 1,
      "position": 2,
      "lap_time_ms": 108250,
      "is_pit_lap": false,
      "is_valid": true
    },
    {
      "session_id": "2025_R13_RACE",
      "driver_id": "PIA",
      "lap_number": 5,
      "position": 1,
      "lap_time_ms": 107410,
      "is_pit_lap": false,
      "is_valid": true
    }
  ],
  "meta": { "page": 1, "per_page": 100, "total_items": 13, "total_pages": 1 }
}
```

### 4.7 `GET /api/v1/races/{grand_prix_id}/events` — events for a race

Defaults to the `RACE` session. The SQL event view follows the envelope in [`event-schema.md`](event-schema.md) §3: accepted submissions retain their envelope; source/legacy normalized rows get synthetic `legacy_*` IDs and `timestamp: null`. Rows order by `event_id`, not chronological timestamp. Existing races with no matching session/events return an empty page.

```json
{
  "data": [
    {
      "event_id": "evt_004",
      "session_id": "2025_R13_RACE",
      "driver_id": "PIA",
      "type": "POSITION_CHANGE",
      "lap_number": 5,
      "timestamp": "2025-07-27T13:41:07Z",
      "payload": {
        "overtaken_driver_id": "NOR",
        "position_before": 2,
        "position_after": 1
      }
    },
    {
      "event_id": "evt_009",
      "session_id": "2025_R13_RACE",
      "driver_id": "ANT",
      "type": "FASTEST_LAP_SET",
      "lap_number": 32,
      "timestamp": "2025-07-27T14:05:00Z",
      "payload": { "lap_time_ms": 104861 }
    }
  ],
  "meta": { "page": 1, "per_page": 100, "total_items": 10, "total_pages": 1 }
}
```

### 4.8 `GET /api/v1/races/{grand_prix_id}/statistics` — derived race statistics

Derives the `RACE` session's statistics from persisted laps/events per [`f1-statistics.md`](f1-statistics.md) §2. It backs the stats grid, results table and overview in `RaceDetails.tsx`. When no classification can be derived, the whole classification falls back to stored `race_results` rows (including `status`, with `consistency_ms: null`); a partial derived classification is not filled out with stored rows. Fastest lap independently falls back to the published result (`time_ms` instead of the derived `lap_time_ms`). Pit stops, position changes and retirements are counted from the event log even when no laps exist.

```json
{
  "data": {
    "grand_prix_id": "2025_R13",
    "session_id": "2025_R13_RACE",
    "total_laps": 44,
    "fastest_lap": { "driver_id": "ANT", "lap_number": 32, "lap_time_ms": 104861 },
    "pit_stop_count": 3,
    "overtake_count": 1,
    "retirement_count": 0,
    "dnf_count": 0,
    "classification": [
      {
        "position": 1,
        "driver_id": "PIA",
        "constructor_id": "MCL",
        "laps": 44,
        "pit_stops": 1,
        "consistency_ms": 595,
        "gap_to_winner_ms": null
      }
    ]
  },
  "meta": {}
}
```

This returns 404 `NOT_FOUND` when the race is unknown, or when it exists but has no `RACE` session. It does not depend on `has_results` (§4.4): a race whose `RACE` session exists returns 200 even if `has_results` is `false`.

The shortened example uses the sample route-test fixture's pit-stop count and PIA row, not a live database snapshot. Derived gaps are null unless every classified driver's full lap log and timing are available; stored gaps may also be null.

### 4.9 `GET /api/v1/constructors/{constructor_id}/stats?season=2025`

Constructor counterpart to §4.3. Per-season aggregation, computed per [`f1-statistics.md`](f1-statistics.md) §3: the constructor's total is the sum of the season's stored `race_results.points` over the `RACE` result rows whose own `constructor_id` is that constructor (`services/constructorStatistics.ts`, rows read by `models/constructors.model.ts` `findSeasonPointRows`). It does not compose `driverStatistics.ts` and does not consult `driver_constructor_links`.

```json
{
  "data": {
    "constructor_id": "MCL",
    "season": "2025",
    "points": 43
  },
  "meta": {}
}
```

404 `NOT_FOUND` if `constructor_id` doesn't exist. `points` is `null` when the constructor has no result rows for the season (no data) and `0` when rows exist but total nothing (a scoreless season). Attribution is per race: a driver who changed teams mid-season has each race's points credited to the team recorded on that result row, so no season-level double counting occurs.

Only `RACE` rows are summed: sprint points are excluded here too.

### 4.10 `GET /api/v1/races/{grand_prix_id}/qualifying` — qualifying classification

The published qualifying classification for a race, read from the `qualifying_results` table (written by the Jolpica ingestion) and joined to `drivers` and `constructors` for names. These stored facts do not feed the backend season-statistics derivation (see §4.3 for where the starting grid comes from). The frontend also uses them in its heuristic prediction page.

```json
{
  "data": {
    "grand_prix_id": "2025_R13",
    "session_id": "2025_R13_QUALIFYING",
    "classification": [
      {
        "position": 1,
        "driver_id": "NOR",
        "given_name": "Lando",
        "family_name": "Norris",
        "constructor_id": "MCL",
        "constructor_name": "McLaren",
        "q1_time_ms": 64962,
        "q2_time_ms": 64634,
        "q3_time_ms": 63971
      }
    ]
  },
  "meta": {}
}
```

The example shows a single row for brevity; a real response lists every driver in the classification. Its values are illustrative (taken from the OpenAPI example and the route test fixture), not a live-API snapshot.

Ordered by `(position, driver_id)`. `q1_time_ms`, `q2_time_ms` and `q3_time_ms` are `null` when the driver set no time in that part, including when they did not reach it. A race that exists but has no QUALIFYING session returns 200 with `session_id: null` and an empty `classification`; a session with no stored rows returns its `session_id` and an empty `classification`. Only an unknown `grand_prix_id` is a 404 `NOT_FOUND`.

The endpoint is public (no `Authorization` header needed), takes no query parameters and is not paginated: it returns the whole classification in one response, so `meta` is always `{}`. The `grand_prix_id` lookup is case-insensitive, and the `grand_prix_id` in the response echoes the path parameter exactly as sent, not normalised. Only the `QUALIFYING` session is read; a `SPRINT_QUALIFYING` session, if one exists, is not included.

---

### 4.11 `GET /api/v1/health` — liveness

Public, static `{ "data": { "status": "ok" }, "meta": {} }`. It does not query PostgreSQL, Firebase or the LLM providers and therefore does not establish their readiness.

### 4.12 `GET /api/v1/export/{dataset}` — CSV or JSON download

Public, unpaginated exports for `races`, `drivers`, `constructors`, `results` and `laps`. `format` is `json` by default or `csv`; `season`, when supplied, must be four digits. A season is required for `results` and `laps`, optional for the other three. Unsupported datasets/formats return `400 VALIDATION_ERROR`.

Both formats set `Content-Disposition: attachment` with filename `f1-{dataset}-{season-or-all}.{format}`. CSV uses a fixed column order, CRLF line endings and quotes commas, quotes and line breaks; null values become empty fields. JSON uses `{ data: [...], meta: { dataset, season, row_count, generated_at } }`. `results` exports stored session rows, including ingested sprints; it does not export computed season totals. Column lists and filters are documented in [Datasets](datasets.md).

### 4.13 `POST /api/v1/chat` — F1 assistant

Public; Firebase authentication is not required. A strict body contains `messages`, with 1–10 `{ role, content }` objects. Roles are `user` or `assistant`, trimmed content must contain 1–1,000 characters, and the final message must be from the user. Extra fields are rejected. The provider receives only the last six submitted messages, alongside the system prompt, tool descriptions and any tool results.

```json
{ "messages": [{ "role": "user", "content": "How did Piastri do in 2025?" }] }
```

```json
{ "data": { "reply": "...", "tools_used": ["get_driver_stats"] }, "meta": {} }
```

The assistant uses Groq first and Gemini as fallback where configured. A conversation allows three tool rounds with at most five executed calls per round, then forces a text response. Provider failure can restart the conversation on the next provider; a short `429` can also retry a call once. Thus four is the maximum completion calls **per conversation attempt**, not a guaranteed maximum upstream request count. See [Third-Party Services](third-party-services.md) for configuration and privacy.

The tools are internal functions, not additional HTTP routes:

| Tool | Current behaviour |
|---|---|
| `search_drivers`, `search_constructors`, `search_races` | Find names/IDs through the SQL models; an unfiltered race search lists the selected season. |
| `get_driver_stats` | Same season statistics as §4.3 plus disqualifications counted from `RACE` result rows with `status = DSQ`. These are separate from retirement-based DNFs. |
| `get_driver_standings` | Ranks drivers with a race result or lap in the season by `points`, `wins`, `podiums`, `fastest_laps`, `dnfs` or `average_finish`; default 10 rows, maximum 25. Returns points and wins leaders over the full field and a separate `points_position` so another sort cannot be mistaken for the points ranking. |
| `get_constructor_standings` | Grand Prix points grouped by the result row's constructor. |
| `get_team_drivers` | Drivers who have `RACE` results for a team, with the number of those results; includes mid-season transfers. |
| `get_race_summary` | Race details, the §4.8 statistics and published qualifying. `lap_data_available` is inferred from a nonempty derived classification; it is not a completeness check. |
| `get_race_events` | `PIT_STOP`, `PENALTY_ISSUED` or `POSITION_CHANGE` summary from up to 500 race events, up to eight examples and a link to the public paginated list. |
| `get_stat_definitions` | Explanations and caveats from `chat/statDefinitions.ts`. |
| `get_export_link` | A URL for the §4.12 download. |

Driver ranking puts nulls last; average finish sorts ascending, other statistics descending. Ties share competition ranks (`1, 2, 2, 4`), with points then driver ID determining display order. Constructor ties share ranks and display by constructor ID. Neither implements official championship countback.

The prompt defaults to 2025 and states that only that season is supported. Statistics remain subject to the same source/coverage limits as the pages. Tool output adds names, converts millisecond values into seconds and is truncated at 12,000 characters. Plain-text formatting is enforced, and reply URLs must have appeared in a tool result from the current request. The prompt asks for facts grounded in tools; this is not an independent fact checker and a response can use no tools.

Season inputs, constructor standings and names are cached for ten minutes in this process, with no write-triggered invalidation. Public statistics endpoints are uncached. Chat limits are ten requests per client IP per fixed 60-second window and `CHAT_DAILY_LIMIT` per UTC day (default 200). Limits count requests before validation/provider calls, reset on restart and are not shared between instances. `429` includes `Retry-After`; missing keys return `503`, provider failure `502`.

---

## 5. Pagination

The paginated lists (`/drivers`, `/races`, `/races/{id}/laps`, `/races/{id}/events`) accept:

| Param | Default | Notes |
|---|---|---|
| `page` | `1` | 1-indexed. |
| `per_page` | `20` (`100` for `laps`/`events`, since a session's log is naturally larger than a page of drivers/races) | Max `100`. Values above the max are clamped, not rejected. |

`meta` on every list response:

```json
{ "page": 1, "per_page": 20, "total_items": 24, "total_pages": 2 }
```

`page` beyond `total_pages` returns `200` with an empty `data` array, not an error.

---

## 6. Filtering

| Endpoint | Query params |
|---|---|
| `GET /drivers` | `constructor_id`, `nationality`, `search` (matches given, family or combined full name, case-insensitive) |
| `GET /races` | `season`, `has_sprint` (`true`/`false`), `search` (matches `race_name`/`country`/`circuit_name` — replaces the client-side filter in `Races.tsx`) |
| `GET /races/{id}/laps` | `driver_id`, `session_type` (default `RACE`; one of the types in `event-schema.md` §2) |
| `GET /races/{id}/events` | `driver_id`, `type` (one of the 8 event types), `session_type` (default `RACE`) |
| `GET /drivers/{id}/stats` | `season` (required) |
| `GET /constructors/{id}/stats` | `season` (required) |

Unknown query params are ignored on these read endpoints. Submission lists accept only `status` and reject unknown parameters (§7).

`has_sprint` accepts only the lowercase literal strings `true` and `false`; other spellings return `400 VALIDATION_ERROR`.

---

## 7. Write endpoints — submission workflow

> `SubmitData.tsx`, `MySubmissions.tsx` and `SubmissionReview.tsx` call these SQL-backed routes. `SubmitterRequests.tsx` still reviews Firestore user profiles directly. Pending submissions are not public event data; acceptance publishes the envelope and normalized row in one PostgreSQL transaction.

All require auth (§8). The event envelope inside a submission is exactly the shape in [`event-schema.md`](event-schema.md) §3 — the backend does not define a second, competing event shape.

### 7.1 `POST /api/v1/submissions`

Requires role `ADMIN`, or `SUBMITTER` with `submitter_status = approved`.

Request body:
```json
{
  "event": {
    "event_id": "evt_example",
    "session_id": "2025_R13_RACE",
    "driver_id": "PIA",
    "type": "LAP_COMPLETED",
    "lap_number": 5,
    "timestamp": "2025-07-27T13:41:07Z",
    "payload": { "lap_time_ms": 92481, "position": 1, "is_pit_lap": false, "is_valid": true }
  }
}
```

Response `201`:
```json
{
  "data": {
    "submission_id": 42,
    "submitted_by": "firebase-user-uid",
    "submitted_by_email": "user@example.com",
    "submitted_at": "2026-08-19T10:15:00Z",
    "status": "pending",
    "validation_errors": [],
    "event": { "...": "as submitted" }
  },
  "meta": {}
}
```

Errors: `VALIDATION_ERROR` (400) for a malformed event or unsupported `type`; `FORBIDDEN` (403) if the caller is a plain `USER` or an unapproved `SUBMITTER`.

### 7.2 `GET /api/v1/submissions`

An approved `SUBMITTER` sees only their own submissions; an `ADMIN` sees all. The only accepted filter is `status` (`pending`/`accepted`/`rejected`); extra query fields, including pagination and `submitted_by`, return `400`. All visible records return newest first, unpaginated, with `meta: {}`.

`GET /api/v1/submissions/mine` is available to any authenticated user and returns only their own history, including after submitter privileges are revoked. It accepts the same `status` filter.

### 7.3 `GET /api/v1/submissions/{submission_id}`

`NOT_FOUND` (404) if it doesn't exist or (`FORBIDDEN` 403) belongs to another non-admin user.

### 7.4 `PATCH /api/v1/submissions/{submission_id}` — review

`ADMIN` only.

```json
{ "status": "rejected", "validation_errors": ["Incorrect driver information for the selected session."] }
```

`FORBIDDEN` (403) for non-admins; `409 SUBMISSION_ALREADY_REVIEWED` if `status` is not currently `pending`.

Acceptance requires `validation_errors: []` (or omission); rejection requires exactly one nonempty reason, at most 2,000 characters. The request is strict. Approval locks the pending row, revalidates the stored event and references, prevents duplicate pending/accepted event IDs, writes `accepted_events` and the appropriate normalized table, and records the reviewer/time atomically. A publication conflict rolls back and leaves the submission pending. Boundaries and fastest-lap markers remain only in the accepted envelope; they do not create lap rows.

### Additional Sprint-2 error codes

| Code | HTTP status | Meaning |
|---|---|---|
| `FORBIDDEN` | 403 | Caller is `USER`, or `SUBMITTER` with `submitter_status != APPROVED`. |
| `SUBMISSION_ALREADY_REVIEWED` | 409 | `PATCH` on a submission whose `status` isn't `pending`. |
| `DUPLICATE_EVENT` | 409 | Event ID is already pending/accepted, or publication conflicts with an existing normalized row. |

---

## 8. Auth

> Only `DELETE /users/me` of the endpoints below is mounted. Firebase Auth and Firestore profiles remain part of the current architecture; the other four endpoints are proposed migration designs, not available APIs.

**Contract:**

1. Frontend authenticates with Firebase Auth using Google Sign-In or email/password; registration and password reset are supported.
2. Frontend sends the Firebase ID token on every request that needs identity:
   ```
   Authorization: Bearer <firebase_id_token>
   ```
3. Backend verifies the token with `firebase-admin`'s `verifyIdToken(token, true)`, including revocation checking. Identity comes from the verified token; authorization comes from the current Firestore `users/{uid}` profile. Missing profiles are rejected, not provisioned by middleware.
4. The frontend creates a missing Firestore profile as `USER`/`none` and observes it with `onSnapshot`. Firestore rules constrain profile edits, access requests and administrator review. PostgreSQL's `users` row is upserted from the authenticated profile during submission creation/review for foreign-key traceability; it is not the authority for privileges.
5. Authentication checks SQL deletion tombstones, Firestore `accountDeletions` markers and `deletionPending`. Deletion requires `auth_time` within five minutes (`RECENT_LOGIN_REQUIRED` otherwise), records a durable SQL request, deletes Firebase identity/profile and anonymizes SQL contact fields while retaining submission relationships. A completed deletion returns `204`; pending cleanup returns `202` and is retried by the backend worker. See [Account deletion](member4-account-deletion.md).

Implemented deletion and proposed migration endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/users/me` | Current user's `role`, `submitter_status`, profile fields. Replaces the Firestore `onSnapshot` in `AuthContext.tsx`. |
| `PATCH /api/v1/users/me/submitter-request` | User requests submitter access (`none → pending`). Replaces the Firestore update in `Account.tsx`. |
| `DELETE /api/v1/users/me` | **Implemented.** Reauthenticated account deletion and durable cleanup. Called by `deleteAccount` in `AuthContext.tsx`. |
| `GET /api/v1/admin/submitter-requests` | `ADMIN` only. Lists users with `submitter_status = pending`. Replaces `SubmitterRequests.tsx`'s Firestore query. |
| `PATCH /api/v1/admin/users/{user_id}` | `ADMIN` only. Approve/reject a submitter request (`role`/`submitter_status` transition). Replaces the Firestore update in `SubmitterRequests.tsx`. |

Every endpoint in §4 and §7 that needs to know *who* is calling uses this same bearer-token contract; endpoints in §4 that don't depend on identity (drivers/races/laps/events — all public read data) don't require the header at all.

---

## 9. What's derivable now, and what's blocked

The functions below derive statistics from persisted laps/events and use published result facts with the precedence in [`f1-statistics.md`](f1-statistics.md). No season aggregate is persisted by these endpoints; source classification/points/grid/fastest-lap facts are stored.

**Derivable today**, assuming a session's full event log exists:

- Lap time, pit stop count/duration, position per lap (raw, direct from events)
- Finishing position, fastest lap, race pace, consistency (stddev), DNF-per-race (derived, per `f1-statistics.md` §2). On the driver stats endpoint, finishing position, starting grid and fastest lap also fall back to published `race_results` values for a session with no lap data (§4.3)
- DNF rate per season (derived, per `f1-statistics.md` §3)

**Blocked — flagging explicitly:**

- **Points fallback and sprint totals.** Driver statistics prefer stored `race_results.points`, with the base P1–P10 scale only where no result row exists. That fallback calculates no fastest-lap bonus. Constructor totals sum stored rows. Both select only `RACE` sessions, so sprint points are always excluded. `points` is `null` only when there is no points data for the season.
- **Positions gained/lost, qualifying-vs-race performance.** Per `f1-statistics.md` §2–3 this needs a starting grid. It is implemented as `positions_gained_lost_avg` (§4.3): the qualifying session's `LAP_COMPLETED` position wins when such events exist, otherwise the stored `race_results.grid_position`. Real ingested races have no qualifying events (the ingestion writes `qualifying_results` rows and a QUALIFYING session, but no events), so the stored grid is the live source for them. The published qualifying classification is served by §4.10 and does not feed the statistic.
- **Safety car / red flag periods.** Flagged in `f1-statistics.md` §4 as a known gap: `LAP_COMPLETED.payload` has no `is_under_safety_car` field, so race-pace and consistency calculations currently have no way to exclude safety-car-distorted laps. Until that field is added to the event schema and populated, `average_race_pace_ms` and consistency figures for any session with a safety car period will be skewed by those laps.
- **Sprint totals.** `grand_prix.has_sprint` marks a sprint weekend and ingestion can store published sprint points, but the driver/constructor statistics and chat standings deliberately select only `RACE` sessions. Ingesting sprints does not turn those responses into official championship totals.

None of these block Sprint 1 read endpoints (§4) for sessions without safety car periods or points requirements — they limit specific cases (fastest-lap and sprint points in the derived fallback, race pace and consistency for sessions without a lap log), and the affected fields are explicitly nullable above rather than a reason to delay the rest of the contract.

---
*This document was edited with the assistance of: Claude-Web[Claude Sonnet 5], Claude-Code[Claude Sonnet 5]*
