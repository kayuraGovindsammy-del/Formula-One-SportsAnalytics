# Third-Party Services

This page covers the external AI services behind the chat assistant
(`POST /api/v1/chat`). It does not cover our data sources (Jolpica-F1 and
OpenF1); see [Jolpica-F1 Pipeline](ingestion/jolpica-ingestion.md) for those.

## What the assistant uses them for

The assistant turns a question such as "How many podiums did Piastri get in
2025?" into calls to our own statistics, then phrases the answer. The language
model never supplies a statistic itself: it can only call a fixed set of
read-only tools (`src/backend/src/chat/tools.ts`) that use the same code as the
public API, and it is told to answer only from their results.

| Provider | Role | Default model | Configured by |
| --- | --- | --- | --- |
| [Groq](https://console.groq.com/) | Primary | `openai/gpt-oss-20b` | `GROQ_API_KEY`, `GROQ_MODEL` |
| [Google Gemini API](https://ai.google.dev/) | Fallback when Groq answers 429 or 5xx, or takes longer than 15 seconds | `gemini-3.5-flash-lite` | `GEMINI_API_KEY`, `GEMINI_MODEL` |

Both are called through their OpenAI-compatible `/chat/completions` endpoints
with plain `fetch`, so no provider SDK is installed. If neither key is set,
the endpoint answers `503` and nothing is sent anywhere.

## What is sent

Each request sends the provider:

- our fixed system prompt and the tool descriptions;
- the conversation from the chat widget: up to 10 messages of up to 1,000
  characters each;
- the tool results, which are public data already served by this API (driver,
  race and constructor statistics, results, events and export links).

No user identity is sent: no Firebase token, email address, user id or IP
address. Anything a user types into the chat is sent as-is, though, so users
should not type personal information into it.

## Limits

Neither provider publishes fixed free-usage numbers that hold for every
account. Each account's limits are shown in the provider's console:

- **Groq:** the [limits page](https://console.groq.com/settings/limits) in
  account settings. Groq's documentation describes the limits for its
  Developer plan; check there whether your key's usage is free or billed.
- **Gemini:** [AI Studio's rate-limit page](https://aistudio.google.com/rate-limit).
  The free tier covers the Flash and Flash-Lite models, including the default.

To stay inside those limits, the backend limits the endpoint itself
(`src/backend/src/middleware/rateLimit.ts`): 10 requests per minute per client
and 800 per day overall, answering `429 RATE_LIMITED` beyond that. A single
chat request can make up to four model calls (three tool rounds and a final
answer).

## Data use and privacy

- **Gemini free tier:** Google's pricing page lists free-tier content as
  ["Used to improve our products: Yes"](https://ai.google.dev/gemini-api/docs/pricing).
  Under the [Gemini API terms](https://ai.google.dev/gemini-api/terms), Google
  uses prompts and responses sent on the unpaid quota to provide, improve and
  develop its products and machine-learning technologies, and human reviewers
  may read and annotate them (after they are disconnected from the account and
  API key). This is the main reason the assistant must not be given personal
  data. Paid use is not used to improve Google's products, and the terms apply
  the paid-use rules to free use from the EEA, Switzerland and the UK.
- **Groq:** Groq's [Your Data](https://console.groq.com/docs/your-data) page
  states that customer data is not retained by default, only when persistence
  features are opted into, or for system reliability and abuse monitoring.

These terms belong to the providers and can change. Re-check both pages before
relying on them, for example before a public launch.
