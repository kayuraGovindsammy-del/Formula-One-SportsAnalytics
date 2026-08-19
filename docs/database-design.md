# Database Design

## 1. Overview

The F1 Sport Analytics platform uses Firebase services for authentication and application data storage.

The system uses:

- **Firebase Authentication** for user authentication.
- **Google Sign-In** as the authentication provider.
- **Cloud Firestore** for user profiles, roles, submitter approval status, and event submissions.

The database design supports three application roles:

- `USER`
- `SUBMITTER`
- `ADMIN`

It also supports the event submission and review workflow required by the platform.

---

## 2. Firebase Architecture

The high-level data flow is:

```text
Google Sign-In
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
      +-------------------+
      |                   |
      v                   v
    users             submissions
```

Firebase Authentication is responsible for identifying the user.

Firestore stores application-specific information that is not part of the Firebase Authentication account, including:

- application role
- submitter approval status
- event submissions
- submission status
- validation/rejection information

---

## 3. Firestore Collections

The current implementation uses two main Firestore collections:

```text
users
submissions
```

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

# 8. Submissions Collection

## Collection

```text
submissions
```

Each submission represents Formula 1 event data submitted by an approved submitter or administrator.

Firestore automatically generates the submission document ID.

Example:

```text
submissions/
    generated-submission-id/
```

---

## 9. Submission Document Structure

A submission contains:

```text
submissions/{submissionId}

submittedBy
submittedByEmail
submittedAt
status
validationErrors
event
```

Example:

```json
{
  "submittedBy": "firebase-user-uid",
  "submittedByEmail": "user@example.com",
  "submittedAt": "Firestore Timestamp",
  "status": "pending",
  "validationErrors": [],
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

### `submittedBy`

Firebase UID of the user who submitted the event.

This provides traceability between a submission and the authenticated user who created it.

### `submittedByEmail`

Email address of the submitter.

This is stored to make administrative review easier.

### `submittedAt`

Firestore server timestamp recording when the submission was created.

### `status`

Current submission review state.

Possible values are:

```text
pending
accepted
rejected
```

### `validationErrors`

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
     validationErrors
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
validationErrors
```

This allows rejected submissions to provide useful feedback rather than failing silently.

---

# 14. Traceability

Traceability is an important part of the database design.

A submission can be traced to:

```text
Submission
    |
    +-- submittedBy
    |       |
    |       v
    |   users/{uid}
    |
    +-- event
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

## Submission Security

A submission can be created by:

- an approved `SUBMITTER`
- an `ADMIN`

A normal `USER` cannot create event submissions.

When a submission is created:

```text
submittedBy
```

must match the Firebase UID of the authenticated user.

New submissions must also begin with:

```text
status = pending
```

Only administrators may change submission review status.

---

# 16. Design Benefits

This design provides several advantages.

### Authentication Separation

Firebase Authentication manages user identity while Firestore manages application-specific authorization information.

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

# 17. Current Sprint Scope

For the current sprint, the database implementation provides the foundation for:

- Google authentication
- Firestore user profiles
- role-based authorization
- submitter access requests
- admin approval/rejection
- Formula 1 event submissions
- submission review
- rejection feedback
- event-to-submission traceability

Future sprints can extend this foundation as additional analytics, validation, processing, and publication functionality is implemented.