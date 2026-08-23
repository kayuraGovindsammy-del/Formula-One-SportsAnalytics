# API Design

*Member 2 — Backend API & Derivation Engine*

This document is the contract for the backend API. It exists so that:

- **Member 3** (frontend) knows exactly what to fetch and what shape comes back.
- **Member 4** knows exactly what the backend expects from them.
- The six files currently talking to Firestore directly (`AuthContext.tsx`, `SubmitData.tsx`, `Account.tsx`, `SubmissionReview.tsx`, `SubmitterRequests.tsx`, `firebase.ts`) have somewhere to migrate to.

It reflects the entities in [`data-model.md`](data-model.md), the event log in [`event-schema.md`](event-schema.md), the formulas in [`f1-statistics.md`](f1-statistics.md), the tables in `schema.sql`, and the actual read shapes the frontend already consumes via `f1Data.ts`.

Read endpoints (§4–6) are **Sprint 1**. Write endpoints and auth (§7–8) are **Sprint 2** — designed now so nobody blocks on the contract later, not implemented yet.

---

## 1. Base URL and versioning

```
/api/v1/...
```

All routes are versioned from day one under `/api/v1`. Breaking changes to a resource's shape get a new version prefix (`/api/v2/...`) rather than mutating `/v1` in place — existing frontend code should never break out from under it without a version bump.

---

## 2. Response envelope

Every successful response:

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

There is never a bare array or bare object at the top level, and a response never mixes `data` and `error`.

### Error codes

| Code | HTTP status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request body or query params failed validation (bad type, missing required field, out-of-range value). |
| `UNAUTHENTICATED` | 401 | No `Authorization` header, or the bearer token is missing/expired/invalid. |
| `FORBIDDEN` | 403 | Authenticated, but the caller's role doesn't permit this action (e.g. a `USER` calling a submitter-only endpoint). |
| `NOT_FOUND` | 404 | The requested resource (driver, race, session, submission, user) doesn't exist. |
| `CONFLICT` | 409 | The request is well-formed but conflicts with current state (e.g. reviewing a submission that's already been reviewed). |
| `RATE_LIMITED` | 429 | Caller exceeded the request rate limit. |
| `INTERNAL_ERROR` | 500 | Unhandled server-side failure. Message is generic; details go to server logs, not the response. |

Sprint-2-specific codes are listed in §7–8 where they apply.

---

## 3. Field naming

**snake_case end to end. No camelCase transformation at the API boundary.**

Every field name in every request and response body matches `schema.sql` and `data/sample/*.json` exactly: `driver_id`, `lap_time_ms`, `is_pit_lap`, `submitted_by`, and so on. The backend does not rename fields for the frontend's convenience, and the frontend does not send camelCase and expect the backend to cope.

This is deliberate, not an oversight: `f1Data.ts` already does this translation client-side today — it imports raw snake_case JSON and maps it into camelCase types (`Driver.driverId`, `Race.hasSprint`, etc.) for the components. That seam already exists and already works. When `f1Data.ts` moves from static JSON imports to `fetch()` calls against this API, it keeps doing exactly the same mapping job it does now — just from a network response instead of a bundled file. Components (`Drivers.tsx`, `RaceDetails.tsx`, etc.) don't change at all.

---

## 4. Read endpoints

Designed directly from what `f1Data.ts` and its consuming pages (`Dashboard.tsx`, `Drivers.tsx`, `Races.tsx`, `DriverDetails.tsx`, `RaceDetails.tsx`) actually need today.

One identifier note up front: races are identified by `grand_prix_id` (e.g. `"2025_R13"`), matching `data-model.md` and `schema.sql`, **not** by bare `round`. The current frontend route (`RaceDetails.tsx`) matches on `race.round` alone, which breaks the moment two seasons share round numbers. Endpoints below use `grand_prix_id`; Member 3 will need a small routing change (`/races/:round` → `/races/:grand_prix_id`) when wiring this up — flagging it here rather than quietly designing around it.

### 4.1 `GET /api/v1/drivers` — driver list

Backs `Drivers.tsx`. `constructor_name` is resolved server-side via a join against `constructors`, so the frontend's hardcoded `constructors.ts` lookup table becomes unnecessary once this is wired up.

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

Backs the "Wins / DNFs / Average Finish / Fastest Laps / Positions Gained / Consistency" stat placeholders in `DriverDetails.tsx` (currently hardcoded `"--"`). Per-season aggregation, computed per the formulas in [`f1-statistics.md`](f1-statistics.md) §3. Some fields are `null` — see §9 for why.

```json
{
  "data": {
    "driver_id": "PIA",
    "season": "2025",
    "races_entered": 1,
    "wins": 1,
    "podiums": 1,
    "dnf_count": 0,
    "dnf_rate": 0.0,
    "fastest_laps": 0,
    "average_finish_position": 1.0,
    "average_race_pace_ms": 92481,
    "points": null,
    "positions_gained_lost_avg": null
  },
  "meta": {}
}
```

`points` and `positions_gained_lost_avg` are `null` with the reason not embedded in the payload — see §9 for what's blocking them and why the fields still exist on the contract now.

### 4.4 `GET /api/v1/races` — race list

Backs `Races.tsx`. `has_results` tells the frontend whether a statistics/results endpoint call for this race will return real data or an empty derivation — this replaces the frontend's current hardcoded `race.round === belgianGpStatistics.round` check in `RaceDetails.tsx`.

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

Defaults to the `RACE` session. Raw event log, matching `events.json` and the envelope in [`event-schema.md`](event-schema.md) §3.

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

The one endpoint that does real derivation-engine work: replays the `RACE` session's event log per [`event-schema.md`](event-schema.md) §4 and [`f1-statistics.md`](f1-statistics.md) §2, and returns the result. This single call backs the entire stats grid, results table, and overview section of `RaceDetails.tsx`, and is what a future Dashboard query would slice down to build "featured race" / top-3 standings (the frontend computes top-N and constructor rollups client-side from `classification`, same as `f1Data.ts` does today — no separate standings endpoint needed for that).

```json
{
  "data": {
    "grand_prix_id": "2025_R13",
    "session_id": "2025_R13_RACE",
    "total_laps": 44,
    "fastest_lap": { "driver_id": "ANT", "lap_number": 32, "lap_time_ms": 104861 },
    "pit_stop_count": 1,
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
        "gap_to_winner_ms": 0
      }
    ]
  },
  "meta": {}
}
```

If `has_results` was `false` on the race resource (§4.4), this returns 404 `NOT_FOUND` rather than an empty-but-200 body — matches the explicit "not available" state `RaceDetails.tsx` already renders today.

---

## 5. Pagination

Every list endpoint (`/drivers`, `/races`, `/races/{id}/laps`, `/races/{id}/events`, and Sprint-2 `/submissions`) accepts:

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
| `GET /drivers` | `constructor_id`, `nationality`, `search` (matches `given_name`/`family_name`, case-insensitive — replaces the client-side filter in `Drivers.tsx`) |
| `GET /races` | `season`, `has_sprint` (`true`/`false`), `search` (matches `race_name`/`country`/`circuit_name` — replaces the client-side filter in `Races.tsx`) |
| `GET /races/{id}/laps` | `driver_id`, `session_type` (default `RACE`; one of the types in `event-schema.md` §2) |
| `GET /races/{id}/events` | `driver_id`, `type` (one of the 8 event types), `session_type` (default `RACE`) |
| `GET /drivers/{id}/stats` | `season` (required) |

Unknown query params are ignored, not rejected — keeps this forward-compatible without a version bump.

---

## 7. Write endpoints — submission workflow (Sprint 2)

> **Sprint 2.** These replace the direct Firestore writes in `SubmitData.tsx`, `SubmissionReview.tsx`, and `SubmitterRequests.tsx`. Designed now so the contract is settled; not implemented in Sprint 1.

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

A `SUBMITTER` sees only their own submissions; an `ADMIN` sees all. Filters: `status` (`pending`/`accepted`/`rejected`), `submitted_by`. Paginated per §5.

### 7.3 `GET /api/v1/submissions/{submission_id}`

`NOT_FOUND` (404) if it doesn't exist or (`FORBIDDEN` 403) belongs to another non-admin user.

### 7.4 `PATCH /api/v1/submissions/{submission_id}` — review

`ADMIN` only.

```json
{ "status": "rejected", "validation_errors": ["Incorrect driver information for the selected session."] }
```

`FORBIDDEN` (403) for non-admins. `CONFLICT` (409, code `SUBMISSION_ALREADY_REVIEWED`) if `status` is not currently `pending`.

### Additional Sprint-2 error codes

| Code | HTTP status | Meaning |
|---|---|---|
| `SUBMITTER_NOT_APPROVED` | 403 | Caller is `USER`, or `SUBMITTER` with `submitter_status != approved`. |
| `SUBMISSION_ALREADY_REVIEWED` | 409 | `PATCH` on a submission whose `status` isn't `pending`. |

---

## 8. Auth (Sprint 2)

> **Sprint 2.** Firebase Auth stays for identity — only Firestore-as-database goes away. This is what replaces the direct `getAuth`/`onAuthStateChanged`/Firestore-user-doc pattern in `AuthContext.tsx`.

**Contract:**

1. Frontend authenticates with Firebase Auth (Google Sign-In) exactly as it does today — unchanged.
2. Frontend sends the Firebase ID token on every request that needs identity:
   ```
   Authorization: Bearer <firebase_id_token>
   ```
3. Backend verifies the token server-side with `firebase-admin`'s `verifyIdToken()`. It does **not** trust any uid/email/role sent in the request body — identity comes only from the verified token.
4. On first-seen `uid`, the backend provisions a row in `users` (mirrors today's `createUserDocument` logic in `AuthContext.tsx`): `role = USER`, `submitter_status = NONE`.
5. `role` and `submitter_status` live in the backend's own `users` table (`database/schema.sql`), not in Firestore. `GET /api/v1/users/me` becomes the replacement for the current `onSnapshot` listener on the Firestore user doc — the frontend polls or re-fetches after actions that could change role/status instead of getting a live push, unless a future sprint adds SSE/WebSocket for that.

Endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/users/me` | Current user's `role`, `submitter_status`, profile fields. Replaces the Firestore `onSnapshot` in `AuthContext.tsx`. |
| `PATCH /api/v1/users/me/submitter-request` | User requests submitter access (`none → pending`). Replaces the Firestore update in `Account.tsx`. |
| `DELETE /api/v1/users/me` | Account deletion (backend row + triggers Firebase Auth deletion). Replaces `deleteAccount` in `AuthContext.tsx`. |
| `GET /api/v1/admin/submitter-requests` | `ADMIN` only. Lists users with `submitter_status = pending`. Replaces `SubmitterRequests.tsx`'s Firestore query. |
| `PATCH /api/v1/admin/users/{user_id}` | `ADMIN` only. Approve/reject a submitter request (`role`/`submitter_status` transition). Replaces the Firestore update in `SubmitterRequests.tsx`. |

Every endpoint in §4 and §7 that needs to know *who* is calling uses this same bearer-token contract; endpoints in §4 that don't depend on identity (drivers/races/laps/events — all public read data) don't require the header at all.

---

## 9. What's derivable now, and what's blocked

Everything below is computed from `database/schema.sql` + the event log per [`f1-statistics.md`](f1-statistics.md), not stored as source of truth.

**Derivable today**, assuming a session's full event log exists:

- Lap time, pit stop count/duration, position per lap (raw, direct from events)
- Finishing position, fastest lap, race pace, consistency (stddev), DNF-per-race (derived, per `f1-statistics.md` §2)
- DNF rate per season (derived, per `f1-statistics.md` §3)

**Blocked — flagging explicitly:**

- **Points (`driver.stats.points`, constructor points).** `race_results.points` exists as a column in `schema.sql`, but there is no points-scoring table or rule defined anywhere in the docs or schema (the standard F1 scale — 25/18/15/12/10/8/6/4/2/1 plus fastest-lap and sprint bonus rules — isn't specified). The derivation engine has nothing to compute points *from* yet. This needs a design decision before `/drivers/{id}/stats.points` can return real values — currently modeled as `null` in the contract above rather than omitted, so the frontend can code against the field's eventual presence now.
- **Positions gained/lost, qualifying-vs-race performance.** Per `f1-statistics.md` §2–3, this needs the starting grid position from the session's `QUALIFYING` classification. The event schema and `sessions` table already support a `QUALIFYING` session type, but no sample data for a qualifying session exists yet (`data/sample/events.json` only covers one `RACE` session). Mechanism exists; data doesn't.
- **Safety car / red flag periods.** Flagged in `f1-statistics.md` §4 as a known gap: `LAP_COMPLETED.payload` has no `is_under_safety_car` field, so race-pace and consistency calculations currently have no way to exclude safety-car-distorted laps. Until that field is added to the event schema and populated, `average_race_pace_ms` and consistency figures for any session with a safety car period will be skewed by those laps.
- **Sprint points scale.** `grand_prix.has_sprint` marks a sprint weekend, but no separate sprint points scale is documented — sprint session points need their own rule, distinct from the main race.

None of these block Sprint 1 read endpoints (§4) for sessions without safety car periods or points requirements — they block specific fields (`points`, `positions_gained_lost_avg`) on the stats endpoint, which are explicitly nullable above rather than a reason to delay the rest of the contract.
