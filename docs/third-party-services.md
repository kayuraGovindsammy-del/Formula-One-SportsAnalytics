# Third-Party Services

This page covers the external AI services behind the chat assistant
(`POST /api/v1/chat`). It does not cover our data sources (Jolpica-F1 and
OpenF1); see [Jolpica-F1 Pipeline](ingestion/jolpica-ingestion.md) for those.

## What the assistant uses them for

The assistant turns a question such as "How many podiums did Piastri get in
2025?" into calls to our own statistics, then phrases the answer. The model
can call only the fixed read-only tools in `src/backend/src/chat/tools.ts`,
which reuse the public API's loaders/statistics functions. The prompt tells
it to answer only from their results, identify Grand Prix-only points totals
and disclose missing telemetry. This is a prompt constraint, not independent
verification of every generated sentence; a response may use no tools.

| Provider | Role | Default model | Configured by |
| --- | --- | --- | --- |
| [Groq](https://console.groq.com/) | Primary | `openai/gpt-oss-20b` | `GROQ_API_KEY`, `GROQ_MODEL` |
| [Google Gemini API](https://ai.google.dev/) | Fallback after a retryable primary failure: 5xx, network error, timeout, or 429 not resolved by a short retry | `gemini-3.5-flash-lite` | `GEMINI_API_KEY`, `GEMINI_MODEL` |

Both are called through their OpenAI-compatible `/chat/completions` endpoints
with plain `fetch`, so no provider SDK is installed. If neither key is set,
the endpoint answers `503` and nothing is sent anywhere.

Each call has a 15-second timeout. A `429` with a header-derived wait of at
most 12 seconds is waited out and retried once on that provider. Retryable
failure restarts the entire conversation/tool loop on the next configured
provider. Other failures, such as a `400`, `401` or malformed response, stop
fallback. Exhausted provider attempts return `502 BAD_GATEWAY`. Providers
without keys are omitted, so Gemini can run alone. These defaults describe
the repository configuration, not a promise of model availability or price.

## What is sent

Each request sends the provider:

- our fixed system prompt and the tool descriptions;
- the last six conversation messages from the chat widget, each at most
  1,000 characters (the HTTP request accepts up to ten messages);
- tool results derived from the same public F1 models/statistics as the API,
  including internal standings/disqualification enrichment, statistic
  definitions, events and export links.

No user identity is sent: no Firebase token, email address, user id or IP
address. Anything a user types into the chat is sent as-is, though, so users
should not type personal information into it.

The backend logs provider name, tool-round count and elapsed time; it does
not log conversation content or API keys in its chat code. Chat history is
provided by the client on each request, not stored in PostgreSQL/Firestore.
Results are enriched with names and seconds-formatted durations, with a
12,000-character tool-output cap. Only URLs returned by a tool in the
current request survive reply formatting. Full tool behaviour is in
[API Design](api-design.md).

## Limits

Provider quotas, billing and availability depend on the account/model and
are not recorded in the repository. Check the provider's console:

- **Groq:** the [limits page](https://console.groq.com/settings/limits) in
  account settings; verify the quota and billing for the configured key.
- **Gemini:** [AI Studio's rate-limit page](https://aistudio.google.com/rate-limit).

To stay inside those limits, the backend limits the endpoint itself
(`src/backend/src/middleware/rateLimit.ts`), answering `429 RATE_LIMITED`
beyond either limit:

- 10 requests per client IP per fixed 60-second window;
- `CHAT_DAILY_LIMIT` requests per UTC day across all clients in this process,
  200 by default (blank/invalid configuration uses that default).

A conversation attempt can make four completion calls (three tool rounds
and a final answer), with at most five tools executed per round. Short-429
retries and provider fallback can make a single HTTP request cost more than
four upstream requests. Set the daily cap against the actual account quota
with headroom for retries/fallback; the default does not guarantee free use.
Requests count before validation/provider calls. `429` responses include
`Retry-After`. Limiter state resets on restart and is not shared between
instances. Express trusts one proxy hop for the client IP.

Season data, constructor standings and names are cached by the chat tools
for ten minutes per process, with no publication-triggered invalidation.
The public statistics endpoints remain uncached, so recent accepted events
or ingestion can appear there before a cached chat answer.

## Data use and privacy

- **Gemini:** consult the [Gemini API terms](https://ai.google.dev/gemini-api/terms)
  and [pricing/data-use information](https://ai.google.dev/gemini-api/docs/pricing)
  for the configured account, region and paid/unpaid quota.
- **Groq:** consult [Your Data](https://console.groq.com/docs/your-data) and
  the account's settings for retention and data-use conditions.

These terms belong to the providers and can change. Re-check both pages before
relying on them, for example before a public launch.

## Selected dependencies and licences

Declared package ranges are shown below; licence information is taken from the
committed lockfiles. The list highlights direct runtime dependencies and major
development tools.

| Area | Package | Declared version | Licence |
| --- | --- | --- | --- |
| Frontend | React / React DOM | `^19.2.8` | MIT |
| Frontend | React Router | `^7.18.2` | MIT |
| Frontend | Firebase | `^12.17.1` | Apache-2.0 |
| Frontend | Recharts | `^3.10.1` | MIT |
| Frontend | Vite | `^8.2.0` | MIT |
| Backend | Express | `^5.2.1` | MIT |
| Backend | `pg` | `^8.23.0` | MIT |
| Backend | Zod | `^4.4.3` | MIT |
| Backend | Firebase Admin | `^14.3.0` | Apache-2.0 |
| Backend | Swagger UI Express | `^5.0.1` | MIT |
| Backend | YAML | `^2.9.1` | ISC |
| Testing | Vitest (backend / frontend) | `^4.1.11` / `^5.0.2` | MIT |
| Testing | Playwright Test | `^1.63.0` | Apache-2.0 |
| Testing | Testing Library React | `^16.3.3` | MIT |
| Testing | Firebase Rules Unit Testing | `^5.0.0` | Apache-2.0 |
| Quality | ESLint | `^10.8.0` | MIT |
| Documentation | MkDocs | `>=1.6,<2.0` | BSD-2-Clause |
