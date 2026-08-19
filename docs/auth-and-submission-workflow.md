# Authentication and Submission Workflow

## 1. Overview

The F1 Sport Analytics platform requires controlled access to Formula 1 event submission functionality.

The authentication and authorization system is designed around three roles:

```text
USER
SUBMITTER
ADMIN
```

The implementation uses:

- Google Sign-In
- Firebase Authentication
- Cloud Firestore
- React protected routes
- Firestore Security Rules

The main goals are to:

1. authenticate users securely
2. create an application profile for each authenticated user
3. prevent unapproved users from submitting event data
4. allow users to request submitter access
5. allow administrators to approve or reject submitter requests
6. allow approved submitters and administrators to submit F1 event data
7. allow administrators to review submissions
8. provide rejection information when submitted data is rejected
9. maintain traceability between users, submissions, and F1 events

---

# 2. Authentication Architecture

Authentication begins with Google Sign-In.

```text
User
 |
 v
Google Sign-In
 |
 v
Firebase Authentication
 |
 v
Firebase UID
 |
 v
Firestore users/{uid}
```

Firebase Authentication verifies the user's identity.

The Firebase UID is then used to locate the user's application profile in Firestore.

---

# 3. Google Sign-In

The login page allows users to authenticate using their Google account.

After successful authentication, Firebase provides information including:

- UID
- display name
- email
- profile image

The Firebase UID is the main identifier used to associate the authenticated user with application data.

---

# 4. First Login

When an authenticated user does not already have a Firestore user document, the application creates one.

The default profile is:

```text
uid = Firebase UID
name = Google display name
email = Google email
photoURL = Google profile image
role = USER
submitterStatus = none
createdAt = server timestamp
```

Therefore, every new user begins as:

```text
USER
```

A newly registered user is not automatically allowed to submit Formula 1 event data.

---

# 5. Authentication State

The application uses Firebase authentication state monitoring to determine whether the user is currently signed in.

The authentication context also monitors the user's Firestore profile.

This allows the application to know:

```text
user
role
submitterStatus
loading
```

For example:

```text
user = authenticated Google user
role = USER
submitterStatus = none
```

If an administrator later approves that user, Firestore changes to:

```text
role = SUBMITTER
submitterStatus = approved
```

The application receives the updated values and can update the available navigation and protected routes.

---

# 6. Role Model

## USER

A normal authenticated user.

A `USER` can:

- access the analytics application
- view drivers
- view races
- view their account
- request submitter access

A `USER` cannot:

- access administrator pages
- review submissions
- approve users
- submit Formula 1 event data

---

## SUBMITTER

A `SUBMITTER` is a user who has been approved to submit event data.

The required state is:

```text
role = SUBMITTER
submitterStatus = approved
```

A submitter can:

- access normal analytics pages
- access the Submit Data page
- submit Formula 1 event data

A submitter cannot:

- approve submitter requests
- review other users' submissions as an administrator

---

## ADMIN

An administrator has:

```text
role = ADMIN
```

An administrator can:

- access normal analytics functionality
- submit Formula 1 event data
- review submitter access requests
- approve submitter requests
- reject submitter requests
- review pending event submissions
- accept event submissions
- reject event submissions

---

# 7. Protected Routes

The application uses route guards to control access to different pages.

## ProtectedRoute

Used for pages that require authentication.

Examples include:

```text
/
 /drivers
 /drivers/:id
 /races
 /races/:id
 /account
```

If the user is not authenticated, they are redirected to:

```text
/login
```

---

## AdminRoute

Used for administrator-only pages.

Examples:

```text
/admin/submitter-requests
/admin/submissions
```

The route requires:

```text
role = ADMIN
```

A non-admin user who manually enters an admin URL is not allowed to access the page.

---

## SubmitterRoute

Used for the event submission page:

```text
/submit
```

Access is allowed when:

```text
role = ADMIN
```

OR:

```text
role = SUBMITTER
AND
submitterStatus = approved
```

This allows administrators to submit event data while still preventing normal users from accessing the submission system.

---

# 8. Navigation by Role

The navigation changes depending on the user's role.

## Normal User

```text
Dashboard
Drivers
Races
Account
```

## Approved Submitter

```text
Dashboard
Drivers
Races
Submit Data
Account
```

## Administrator

```text
Dashboard
Drivers
Races
Submit Data
Submitter Requests
Review Submissions
Account
```

Navigation visibility improves the user experience, while Firestore Security Rules provide the database-level authorization.

---

# 9. Submitter Access Request

A new user begins with:

```text
role = USER
submitterStatus = none
```

The Account page displays:

```text
Request Submitter Access
```

When the user selects this option:

```text
submitterStatus
none
 |
 v
pending
```

The user's role remains:

```text
USER
```

while the request is waiting for administrative review.

---

# 10. Submitter Approval Workflow

The complete workflow is:

```text
USER
 |
 | Request Submitter Access
 v
submitterStatus = pending
 |
 v
ADMIN REVIEW
 |
 +---------------------+
 |                     |
 | APPROVE             | REJECT
 v                     v
role = SUBMITTER       role = USER
status = approved      status = rejected
```

---

# 11. Administrator Submitter Review

Administrators can access:

```text
/admin/submitter-requests
```

The page displays users whose:

```text
submitterStatus = pending
```

The administrator can:

```text
Approve
Reject
```

---

## Approval

When an administrator approves the request:

```text
BEFORE

role = USER
submitterStatus = pending
```

becomes:

```text
AFTER

role = SUBMITTER
submitterStatus = approved
```

The user can then access:

```text
/submit
```

---

## Rejection

When an administrator rejects the request:

```text
role = USER
submitterStatus = rejected
```

The user does not receive submission privileges.

---

# 12. Formula 1 Event Submission

Approved submitters and administrators can access:

```text
/submit
```

The submission form follows the event model defined in:

```text
docs/event-schema.md
```

The submission system does not create a separate competing F1 event model.

---

# 13. Supported Event Types

The submission interface supports the event types defined by the project:

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

The form dynamically changes according to the selected event type.

---

# 14. Common Event Information

The common event structure contains fields such as:

```text
event_id
session_id
driver_id
type
lap_number
timestamp
payload
```

Some fields depend on the event type.

For example, session boundary events do not require the same driver/lap information as driver-specific events.

---

# 15. Dynamic Event Payloads

Different event types require different payload information.

## LAP_COMPLETED

```text
lap_time_ms
position
is_pit_lap
is_valid
```

## PIT_STOP

```text
duration_ms
tyre_in
tyre_out
```

## POSITION_CHANGE

```text
overtaken_driver_id
position_before
position_after
```

## PENALTY_ISSUED

```text
penalty_type
duration_ms
reason
```

## RETIREMENT

```text
reason
```

## FASTEST_LAP_SET

```text
lap_time_ms
```

## SESSION_START / SESSION_END

No additional payload information is required by the current submission form.

---

# 16. Submission Validation

The submission form performs basic validation before creating a Firestore submission.

Examples include:

- Session ID must be provided.
- Required Driver ID must be provided.
- Required lap numbers must be positive whole numbers.
- Lap times must be positive.
- Positions must be positive whole numbers.
- Pit stop duration must be positive.
- Position change data must contain valid before/after positions.
- Penalties must include required information.
- Retirement events must include a reason.

If validation fails, the event is not submitted and the user receives an explanatory message.

Example:

```text
Lap number must be a positive whole number.
```

rather than a generic submission failure.

---

# 17. Submission Creation

When validation succeeds, the application creates a Firestore document in:

```text
submissions
```

The submission wrapper contains:

```text
submittedBy
submittedByEmail
submittedAt
status
validationErrors
event
```

A new submission begins with:

```text
status = pending
validationErrors = []
```

---

# 18. Example Submission

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
    "type": "POSITION_CHANGE",
    "lap_number": 5,
    "timestamp": "2025-07-27T13:41:07.000Z",
    "payload": {
      "overtaken_driver_id": "NOR",
      "position_before": 2,
      "position_after": 1
    }
  }
}
```

---

# 19. Submission Review Workflow

After an event is submitted:

```text
SUBMITTER / ADMIN
        |
        v
   Submit Event
        |
        v
Basic Validation
        |
        v
Firestore Submission
status = pending
        |
        v
   ADMIN REVIEW
        |
   +----+----+
   |         |
 Accept     Reject
   |         |
   v         v
accepted   rejected
             |
             v
      rejection reason
```

---

# 20. Administrator Submission Review

Administrators can access:

```text
/admin/submissions
```

The page displays pending submissions.

The administrator can inspect:

- event type
- submitter
- event ID
- session ID
- driver ID
- lap number
- timestamp
- event payload

The administrator then chooses:

```text
Accept
```

or:

```text
Reject
```

---

# 21. Accepting a Submission

When accepted:

```text
status
pending
 |
 v
accepted
```

The validation error list remains empty:

```json
[]
```

---

# 22. Rejecting a Submission

When an administrator rejects a submission, a rejection reason is required.

The submission becomes:

```text
status = rejected
```

and the reason is stored in:

```text
validationErrors
```

Example:

```json
{
  "status": "rejected",
  "validationErrors": [
    "Incorrect driver information for the selected session."
  ]
}
```

This ensures that rejected submissions provide useful information about why they were not accepted.

---

# 23. Submission Traceability

Every submission stores:

```text
submittedBy
submittedByEmail
submittedAt
event
```

This provides a traceable relationship:

```text
Authenticated User
       |
       v
Firestore User Profile
       |
       v
Submission
       |
       v
F1 Event
```

The system can therefore determine:

- who submitted an event
- when it was submitted
- which event was submitted
- whether it was accepted or rejected
- why it was rejected

---

# 24. Firestore Security

React route protection is used to control the application's interface.

However, route protection alone is not considered sufficient security.

Firestore Security Rules provide database-level authorization.

The rules ensure that normal users cannot bypass the interface and perform unauthorized database operations.

---

# 25. User Security Rules

A new user may create their own profile only with the default role and status:

```text
role = USER
submitterStatus = none
```

A normal user can request submitter access:

```text
none -> pending
```

A normal user cannot promote themselves to:

```text
SUBMITTER
ADMIN
```

Administrator privileges are required for role approval.

---

# 26. Submission Security Rules

Submission creation is allowed for:

```text
ADMIN
```

or:

```text
SUBMITTER
+
submitterStatus = approved
```

A new submission must:

1. belong to the currently authenticated user
2. begin with `status = pending`

Normal users cannot create submissions.

Only administrators can modify the review state of a submission.

---

# 27. Account Management

Authenticated users can access their account page.

The account page provides:

- Google profile information
- email
- application role
- submitter status
- submitter access request
- sign out
- account deletion

Signing out ends the Firebase Authentication session.

Account deletion removes the user's application profile and Firebase Authentication account.

Firebase Authentication may require a recent login before allowing account deletion for security reasons.

---

# 28. Security Model Summary

```text
                    FIREBASE AUTHENTICATION
                             |
                             v
                       AUTHENTICATED?
                        /         \
                      NO           YES
                      |             |
                      v             v
                   /login       Firestore User
                                      |
                         +------------+------------+
                         |            |            |
                         v            v            v
                       USER       SUBMITTER      ADMIN
                         |            |            |
                         |            |            +--> Submit Data
                         |            |            +--> Approve Users
                         |            |            +--> Review Submissions
                         |            |
                         |            +--> Submit Data
                         |
                         +--> Request Submitter Access
```

---

# 29. Current Sprint Implementation

The current sprint establishes the authentication and controlled submission foundation for the F1 Sport Analytics platform.

Implemented functionality includes:

- Google Sign-In
- Firebase Authentication
- automatic Firestore user creation
- USER, SUBMITTER and ADMIN roles
- account management
- submitter access requests
- administrator approval/rejection
- role-based route protection
- role-based navigation
- dynamic F1 event submission
- event validation
- Firestore submission storage
- administrator submission review
- submission acceptance
- submission rejection with reasons
- Firestore Security Rules
- user-to-submission traceability

This provides the foundation that later sprints can extend with additional event processing, analytics, statistics generation, and publication functionality.