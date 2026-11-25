# Database Design

## 1. Overview

The F1 Sport Analytics platform uses Firebase for identity and profiles, and PostgreSQL for F1 data and reviewed submissions.

The system uses:

- **Firebase Authentication** for user authentication.
- **Google Sign-In and email/password** as authentication providers.
- **Cloud Firestore** for user profiles, roles, submitter approval state and server-owned deletion markers.
- **Aiven PostgreSQL**, accessed through the Express backend's `pg` pool, for sports data, submission history, accepted envelopes and SQL account-deletion tombstones.

The database design supports three application roles:

- `USER`
- `SUBMITTER`
- `ADMIN`

It also supports the event submission and review workflow required by the platform.

---

## 2. Firebase Architecture

The high-level data flow is:

```text
Google / email-password sign-in
      |
      v
Firebase Authentication
      |
      v
Firebase UID
      |
      v
Cloud Firestore
      |
      +--> users/{uid} (profiles, roles, access requests)
      +--> accountDeletions/{uid} (server-owned marker)

Firebase ID token + current Firestore profile
      |
      v
Express authentication + authorization
      |
      v
Aiven PostgreSQL
      +--> users (submission/reviewer identity mirror)
      +--> submissions -> accepted_events + normalized event rows
      +--> seasons, grand_prix, sessions, results, qualifying, ...
      +--> account_deletions (durable cleanup requests)
```

Firebase Authentication is responsible for identifying the user.

Firestore stores application-specific information that is not part of the Firebase Authentication account, including:

- application role
- submitter approval status
- submitter request/review timestamps and reason
- deletion markers

PostgreSQL stores pending/reviewed event submissions and their rejection information. The backend pool verifies TLS using `DATABASE_CA_CERT` or local `certs/ca.pem`; credentials and certificate contents remain outside the repository. See [Setup](setup.md).

---

## 3. Firestore Collections

The current implementation uses these Firestore collections:

```text
users
accountDeletions
```

There is no client-accessible Firestore submission collection. Firestore rules deny unmatched collections; submissions use the SQL API. The PostgreSQL entities/constraints are in [Data Model](data-model.md), `database/schema.sql` and additive migrations `001`–`007`. Schema/seed files bootstrap a new database; existing databases use the applicable migrations rather than rerunning a bootstrap.

---

# 4. Users Collection

## Collection

```text
users
```

Each authenticated user has one Firestore document.

The Firebase Authentication UID is used as the Firestore document ID.

Example:

```text
users/
    firebase-user-uid/
```

## User Document Structure

```text
users/{uid}

uid
name
email
photoURL
role
submitterStatus
createdAt
requestedAt / reviewedAt / reviewedBy / reviewReason (after a request)
deletionPending (server-owned during cleanup)
```

Example:

```json
{
  "uid": "firebase-user-uid",
  "name": "Example User",
  "email": "user@example.com",
  "photoURL": "https://...",
  "role": "USER",
  "submitterStatus": "none",
  "createdAt": "Firestore Timestamp"
}
```

---

## 5. User Fields

### `uid`

The unique Firebase Authentication user ID.

This value also corresponds to the Firestore user document ID.

### `name`

The user's display name received from their Google account.

### `email`

The user's authenticated Google email address.

### `photoURL`

The URL of the user's Google profile image.

### `role`

The user's current application role.

Allowed roles are:

```text
USER
SUBMITTER
ADMIN
```

### `submitterStatus`

Represents the state of a user's submitter access request.

Possible values are:

```text
none
pending
approved
rejected
```

### `createdAt`

Firestore server timestamp representing when the user profile was first created.

---

# 6. Application Roles

## USER

A normal authenticated user.

A `USER` can:

- sign in using Google
- view the analytics application
- view their account
- request submitter access

A normal user cannot:

- approve submitter requests
- review submissions
- assign themselves another role
- submit event data unless approved as a submitter

---

## SUBMITTER

A user who has requested submitter access and has been approved by an administrator.

An approved submitter has:

```text
role = SUBMITTER
submitterStatus = approved
```

A submitter can:

- access normal analytics functionality
- access the Submit Data page
- submit Formula 1 event data
- create pending submissions

---

## ADMIN

An administrator has:

```text
role = ADMIN
```

An administrator can:

- access normal analytics functionality
- review submitter access requests
- approve submitter requests
- reject submitter requests
- submit Formula 1 event data
- review pending event submissions
- accept submissions
- reject submissions

The initial administrator can be bootstrapped manually through Firestore for development/testing purposes.

Normal users cannot promote themselves to `ADMIN`.

---

# 7. Submitter Status Workflow

A newly created user starts with:

```text
role = USER
submitterStatus = none
```

The user can request submitter access.

The state then becomes:

```text
role = USER
submitterStatus = pending
```

An administrator reviews the request.

If approved:

```text
role = SUBMITTER
submitterStatus = approved
```

If rejected:

```text
role = USER
submitterStatus = rejected
```

The workflow can be represented as:

```text
USER
 |
 | Request Submitter Access
 v
PENDING
 |
 +-------------------+
 |                   |
 | Approve           | Reject
 v                   v
SUBMITTER            USER
approved             rejected
```

---

# 8. PostgreSQL Submissions

## Table

```text
submissions
```

Each submission represents Formula 1 event data submitted by an approved submitter or administrator. PostgreSQL generates its integer `submission_id`.

Example:

```text
submissions (submission_id BIGSERIAL primary key)
```

---

## 9. Submission Storage and API Structure

A submission contains:

```text
submission_id
submitter_user_id -> users.user_id
session_id -> sessions.session_id
status
event_data (JSONB)
validation_message
submitted_at
reviewed_at
reviewed_by -> users.user_id
source_filename (nullable; not used by the current form)
```

The API joins the user rows for display and returns snake_case fields. SQL enums use uppercase (`PENDING`, `ACCEPTED`, `REJECTED`); the API status uses lowercase and converts a single `validation_message` into `validation_errors: []` or `[reason]`.

Example:

```json
{
  "submission_id": 42,
  "submitted_by": "firebase-user-uid",
  "submitted_by_email": "user@example.com",
  "submitted_at": "2026-09-10T10:15:00Z",
  "reviewed_at": null,
  "reviewed_by": null,
  "reviewed_by_email": null,
  "status": "pending",
  "validation_errors": [],
  "event": {
    "event_id": "evt_example",
    "session_id": "2025_R13_RACE",
    "driver_id": "PIA",
    "type": "LAP_COMPLETED",
    "lap_number": 5,
    "timestamp": "2025-07-27T13:41:07.000Z",
    "payload": {
      "lap_time_ms": 92481,
      "position": 1,
      "is_pit_lap": false,
      "is_valid": true
    }
  }
}
```

---

# 10. Submission Fields

### `submitted_by`

Firebase UID of the user who submitted the event.

This provides traceability between a submission and the authenticated user who created it.

### `submitted_by_email`

Email address of the submitter.

This is read from the joined SQL user mirror to make administrative review easier; it is not copied into each submission row.

### `submitted_at`

PostgreSQL timestamp recording when the submission was created.

### `status`

Current submission review state.

Possible values are:

```text
pending
accepted
rejected
```

### `validation_errors`

An array containing validation or rejection information.

A new valid submission begins with:

```json
[]
```

If an administrator rejects the submission, the rejection reason can be stored in this array.

Example:

```json
[
  "Submitted lap information does not match the session."
]
```

### `event`

Contains the Formula 1 event being submitted.

The event structure follows the project's existing event schema.

---

# 11. F1 Event Structure

The common event structure is:

```text
event
 |
 +-- event_id
 +-- session_id
 +-- driver_id
 +-- type
 +-- lap_number
 +-- timestamp
 +-- payload
```

The exact fields present depend on the event type.

The supported event types are:

```text
SESSION_START
SESSION_END
LAP_COMPLETED
PIT_STOP
POSITION_CHANGE
PENALTY_ISSUED
RETIREMENT
FASTEST_LAP_SET
```

The `payload` contains information specific to the selected event type.

The detailed event definitions remain documented in:

```text
docs/event-schema.md
```

This database design does not redefine that schema. The submission system stores events using the existing project event model.

---

# 12. Event Payload Examples

## LAP_COMPLETED

```json
{
  "lap_time_ms": 92481,
  "position": 1,
  "is_pit_lap": false,
  "is_valid": true
}
```

## PIT_STOP

```json
{
  "duration_ms": 2340,
  "tyre_in": "medium",
  "tyre_out": "hard"
}
```

## POSITION_CHANGE

```json
{
  "overtaken_driver_id": "NOR",
  "position_before": 2,
  "position_after": 1
}
```

## PENALTY_ISSUED

Example time penalty:

```json
{
  "penalty_type": "TIME",
  "duration_ms": 5000,
  "reason": "Track limits"
}
```

## RETIREMENT

```json
{
  "reason": "Engine failure"
}
```

## FASTEST_LAP_SET

```json
{
  "lap_time_ms": 104861
}
```

---

# 13. Submission Status Workflow

Every new event submission begins with:

```text
status = pending
```

An administrator then reviews it.

The workflow is:

```text
Event Submitted
      |
      v
   PENDING
      |
 +----+----+
 |         |
 | Accept  | Reject
 v         v
ACCEPTED  REJECTED
             |
             v
     validation_errors
```

An accepted submission has:

```text
status = accepted
```

A rejected submission has:

```text
status = rejected
```

and contains a reason in:

```text
validation_errors
```

This allows rejected submissions to provide useful feedback rather than failing silently.

Approval locks the pending row, revalidates its event and database references, writes the `accepted_events` envelope and its applicable normalized event row, and records review state/time/admin in one transaction. Rejection publishes nothing. Duplicate pending/accepted event IDs or normalized-row conflicts return `409`; failed publication rolls back the whole approval. Reviewed rows cannot transition again.

`accepted_events.submission_id` is unique and all normalized event tables carry nullable `submission_id` references. The public event reader combines accepted envelopes with only source/legacy normalized rows whose `submission_id IS NULL`, preventing double counting. `laps` reads persisted rows directly, including published submissions. No statistics totals or chat conversations are persisted by the chat implementation.

---

# 14. Traceability

Traceability is an important part of the database design.

A submission can be traced to:

```text
Submission
    |
    +-- submitter_user_id
    |       |
    |       v
    |   PostgreSQL users (auth_uid matches Firestore users/{uid})
    |
    +-- event_data
            |
            v
       F1 event data
```

The system therefore retains information about:

- who submitted an event
- when the event was submitted
- which event was submitted
- whether it was accepted or rejected
- why it was rejected when applicable

---

# 15. Firestore Security

Firestore Security Rules provide database-level authorization.

Frontend route protection is used for user experience, but it is not treated as the main security mechanism.

The database rules enforce access based on the authenticated Firebase UID and the role stored in the user's Firestore document.

---

## User Security

Users can create their own initial profile with:

```text
role = USER
submitterStatus = none
```

A normal user may request submitter access by changing:

```text
submitterStatus
none -> pending
```

A normal user cannot change their own role to:

```text
SUBMITTER
ADMIN
```

Role changes are controlled by administrators.

---

## Submission API Security

A submission can be created by:

- an approved `SUBMITTER`
- an `ADMIN`

A normal `USER` cannot create event submissions.

When a submission is created:

```text
submitted_by
```

must match the Firebase UID of the authenticated user.

New submissions must also begin with:

```text
status = pending
```

Only administrators may change submission review status. Firebase Admin verifies the bearer token and reads the current Firestore role/status; parameterized SQL performs the validated operation. The SQL `users` mirror is not used as the current authority for privileges.

`GET /submissions` filters ownership for approved submitters and returns all records for admins. `GET /submissions/mine` permits every authenticated owner to read their history; detail access is owner/admin only. Lists are unpaginated and accept only `status`. Reviewer identity is exposed only to administrators.

Firestore `accountDeletions` markers are denied to all client reads/writes. Profile deletion also requires the backend. Account cleanup keeps stable SQL user/submission foreign keys, replaces the UID/contact details and role with anonymized values, and retains the original UID only in deletion tombstones. Pending cleanup is retried; see [Account deletion](member4-account-deletion.md).

---

# 16. Design Benefits

This design provides several advantages.

### Authentication Separation

Firebase Authentication manages user identity while Firestore manages application-specific authorization information. PostgreSQL holds the reviewed sports-data workflow and relational traceability.

### Role-Based Access

The role model clearly separates normal users, approved submitters, and administrators.

### Controlled Data Submission

Only authorized users can submit Formula 1 event data.

### Review Workflow

Submitted events are not automatically treated as accepted data. They first enter a pending review state.

### Traceability

Every submission remains linked to the authenticated user who created it.

### Schema Consistency

Submitted F1 events use the event schema already defined elsewhere in the project instead of introducing a separate event representation.

---

# 17. Current Implementation

The current database implementation supports:

- Google authentication
- Firestore user profiles
- role-based authorization
- submitter access requests
- admin approval/rejection
- Formula 1 event submissions
- submission review
- rejection feedback
- event-to-submission traceability
- atomic publication and SQL-backed public lap/event readers
- Jolpica results/qualifying/pit-stop/retirement ingestion and OpenF1 position-change ingestion
- durable deletion requests and anonymization

Published `race_results` facts supplement lap/event derivation when telemetry is absent. Driver/constructor totals and chat standings select `RACE` sessions only; exports can include ingested `SPRINT` rows. Current mappings and limits are documented in [F1 Statistics](f1-statistics.md) and [Jolpica ingestion](ingestion/jolpica-ingestion.md).
