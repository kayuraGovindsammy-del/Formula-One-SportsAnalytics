# User Guide

This guide describes the current frontend. Its analytics pages require
sign-in, even though the backend's read and dataset-export endpoints are
public. Most season statistics currently use **2025**; the interface does
not provide a general season selector.

## Core Feature Coverage

| Core capability | Current implementation | Supporting documentation |
|---|---|---|
| Driver, constructor and race browsing | Browse searchable driver, constructor, and race pages, with detail views. | [Explore Formula 1 data](#explore-formula-1-data) |
| Formula 1 statistics and analytics | View season statistics, rankings, comparisons, race charts, and derived metrics where data is available. | [Explore Formula 1 data](#explore-formula-1-data), [F1 Statistics](f1-statistics.md) |
| Approved submitter data contribution | Approved submitters can submit event records for review. | [Submit and review events](#submit-and-review-events), [Authentication and Submission Workflow](auth-and-submission-workflow.md) |
| Administrator review and management | Administrators manage submitter requests and review submitted records. | [Submit and review events](#submit-and-review-events), [Authentication and Submission Workflow](auth-and-submission-workflow.md) |
| Hand-written public Express API | The custom Express API exposes public read and dataset-export routes with a documented OpenAPI contract. | [API Design](api-design.md), [OpenAPI](api/openapi.yaml) |
| Event-derived analytics/statistics | Statistics derive from stored event/lap data where available and use documented published-result fallbacks for supported metrics. | [F1 Statistics](f1-statistics.md), [Event Schema](event-schema.md) |
| External Formula 1 data integration | Jolpica supplies season/race results and related data; OpenF1 supplies position-change/overtake events. | [Jolpica-F1 Pipeline](ingestion/jolpica-ingestion.md), [OpenF1 Overtakes](ingestion/openf1-overtakes.md) |
| CSV/JSON datasets | Public export routes provide supported datasets in CSV or JSON. | [Download datasets](#download-datasets), [Datasets](datasets.md) |
| Authentication and account management | Firebase sign-in, registration, password reset, role-aware access, and account deletion are provided. | [Sign in and account access](#sign-in-and-account-access), [Authentication and Submission Workflow](auth-and-submission-workflow.md) |

## Sign in and account access

Opening the dashboard while signed out redirects to `/login`. Use email
and password or **Sign in with Google**. **Register** creates an email
account and requires matching passwords of at least eight characters.
**Forgot password** sends a Firebase password-reset email.

**My Account** shows your identity, role, and submitter status. A normal
user can request submitter access and request again after rejection. A
pending request needs administrator approval before **Submit Data** is
available. All signed-in users can open **My Submissions**; administrator
review pages require the `ADMIN` role.

Account deletion requires the confirmation checkbox, a final confirmation,
and recent authentication using a password or Google. The application
returns to login with either a completion message or a cleanup-in-progress
message. Historical submissions remain with anonymized contributor details.
See [Authentication and Submission Workflow](auth-and-submission-workflow.md)
for the access and deletion rules.

## Explore Formula 1 data

| Page | What to do |
|---|---|
| Dashboard | Open the driver/race/constructor/statistics shortcuts and featured race. Counts come from the lists loaded by the application. |
| Drivers | Search by driver name, filter by team, and open a driver card. Details include season points, wins, podiums, fastest laps, average race pace/finish, positions gained/lost, and DNFs/DNF rate where data exists. |
| Constructors | View teams and their season Grand Prix points and rankings. |
| Races | Search by race name, country, or circuit. Select **Race**, **Qualifying**, or **Predictions** on a card, then use its matching view button. |
| Race details | Inspect the classification, fastest-lap information, pit-stop summaries, and timeline highlights. |
| Qualifying | Inspect Q1/Q2/Q3 times and the qualifying classification, including pole position. |
| Statistics | Compare two distinct drivers using **Compare**, inspect positions-gained charts, and select a race for classification, podium, constructor, gap, and pit-stop charts. |

Driver and race search/filter choices are reflected in the URL. Race-list
scroll position is restored when returning with browser back navigation.
Missing data and failed requests are shown through the pages' empty/error
states; a missing lap-based metric does not establish that a driver was
slow or had no activity.

The race timeline highlights pit stops, overtakes/position changes,
retirements, and fastest laps. Filter by event type, driver, and selected lap, choose
earliest/latest order, and use **Show more** to expand the initial eight
lap groups. It is a highlight view of those event types, rather than a
complete display of every submitted event type.

When the statistics response has a fastest lap but the event list has no
matching marker, race details adds a display entry from those statistics.

### Predictions

The prediction page uses a fixed frontend formula: 60% qualifying position
and 40% season average finishing position. Missing average finish falls
back to qualifying position. Predicted pace starts with the best available
positive Q1/Q2/Q3 time multiplied by 1.07; when season race pace exists,
the estimate blends 60% qualifying-based pace and 40% season pace. Pace
breaks ties in the position score. Drivers without a timed qualifying lap
are omitted.

The statistics request uses the whole season with no cutoff before the
selected race. The display's references to "previous" results therefore
do not establish a forecast using only data available before that race.
There is no recorded model training, backtest, or prediction-accuracy
measurement. [F1 Statistics](f1-statistics.md) describes the underlying
statistics and their data limits.

## Download datasets

Drivers, Races, and Constructors provide **CSV** and **JSON** downloads.
The Races page offers the season calendar and season results; those
downloads cover the season. Lap downloads are available through the export
API rather than a control on the current race-detail page.
[Datasets](datasets.md) explains the available columns and API filters.

## Ask the F1 Assistant

Open the floating robot on any page, including login. Ask about drivers,
teams, races, standings, or the platform's statistic definitions. Factual
answers use the application's data tools; the assistant can also explain
or discuss that information.

- Use **Enter** to send and **Shift+Enter** for a newline. Messages are
  limited to 1,000 characters.
- **Escape** closes the panel. Closing it or navigating between pages keeps
  the conversation in memory. Reloading, signing out, or switching users
  starts a fresh conversation.
- The request sends at most the latest ten user/assistant turns. A
  still-working note appears on slow replies; errors offer **Retry**.

The assistant needs a configured provider and is rate-limited. It may be
unavailable while the rest of the app works. Conversation text and tool
results are sent to the configured LLM provider; see
[Third-Party Services](third-party-services.md).

## Submit and review events

1. Request submitter access from **My Account** and wait for approval.
2. Open **Submit Data**, enter an existing session ID, choose the event
   type, and enter the event timestamp. Driver/lap fields appear where
   required. The form submits one event at a time.
3. Complete the event-specific fields. Lap times use `M:SS.mmm`; pit-stop
   and time-penalty durations use seconds. Supported types are session
   start/end, lap completed, pit stop, position change, penalty, retirement,
   and fastest lap.
4. Submit for review and retain the displayed submission number. Use
   **My Submissions** to filter pending/accepted/rejected records, inspect
   payloads and review reasons, and refresh their status.

The generated Event ID remains stable when retrying a request. If a request
may already have succeeded, check **My Submissions** before generating a
new ID. Pending/rejected data does not enter the accepted analytics data.

Administrators use **Submitter Requests** to approve/reject pending access
requests (rejection needs a reason), and **Submission Review** to inspect
events and confirm acceptance/rejection. Submission decisions are final;
terminal records cannot be reviewed again. The implementation and API
contract are in [Authentication and Submission Workflow](auth-and-submission-workflow.md)
and [API Design](api-design.md).
