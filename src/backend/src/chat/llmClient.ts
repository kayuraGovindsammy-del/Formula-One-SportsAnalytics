// ---------------------------------------------------------------------------
// Minimal client for OpenAI-compatible /chat/completions endpoints.
//
// Groq is the primary provider and Gemini's OpenAI-compatible endpoint the
// fallback. Plain fetch, injectable for tests — the same pattern as
// ingestion/jolpicaClient.ts — so no SDK dependency is needed.
//
// Nothing here logs API keys or message content: errors carry only the
// provider name and HTTP status.
// ---------------------------------------------------------------------------

import { z } from "zod";

export type FetchLike = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

export interface LlmProvider {
  name: "groq" | "gemini";
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai";

/** Production model on Groq with tool-use support (console.groq.com/docs/models). */
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
/** Free-tier Flash-Lite model (ai.google.dev/gemini-api/docs/pricing). */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

export const DEFAULT_TIMEOUT_MS = 15_000;

/** A 429 whose limit resets within this long is retried once on the same provider. */
export const MAX_RATE_LIMIT_WAIT_MS = 3_000;

/**
 * The reasoning effort to request, or undefined to send none. Groq's gpt-oss
 * models accept "low" (console.groq.com/docs/reasoning). Gemini 3 models
 * cannot turn thinking off but accept "minimal"; Gemini 2.5 Flash models
 * accept "none" (ai.google.dev/gemini-api/docs/openai). Other models get
 * nothing, since an unsupported value is a 400.
 */
export function reasoningEffortFor(provider: LlmProvider): string | undefined {
  if (provider.name === "groq") {
    return provider.model.startsWith("openai/gpt-oss") ? "low" : undefined;
  }
  if (provider.model.startsWith("gemini-2.5-flash")) return "none";
  if (provider.model.startsWith("gemini-3")) return "minimal";
  return undefined;
}

/**
 * Seconds until a 429 clears: Groq's retry-after (seconds), else its
 * x-ratelimit-reset-tokens duration ("7.66s", "1m2.5s", "250ms").
 * Undefined when neither can be read.
 */
export function rateLimitWaitMs(headers: Headers): number | undefined {
  const retryAfter = headers.get("retry-after");
  if (retryAfter !== null && /^\d+(\.\d+)?$/.test(retryAfter.trim())) {
    return Number(retryAfter) * 1000;
  }

  const reset = headers.get("x-ratelimit-reset-tokens")?.trim();
  if (!reset) return undefined;

  const parts = [...reset.matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)];
  if (parts.length === 0 || parts.map((part) => part[0]).join("") !== reset) return undefined;

  const scale: Record<string, number> = { h: 3_600_000, m: 60_000, s: 1_000, ms: 1 };
  return parts.reduce((total, part) => total + Number(part[1]) * (scale[part[2] ?? ""] ?? 0), 0);
}

/**
 * The configured providers, in fallback order. A provider without a key is
 * left out, so an empty list means the assistant is not configured.
 */
export function providersFromEnv(
  env: NodeJS.ProcessEnv = process.env
): LlmProvider[] {
  const providers: LlmProvider[] = [];

  const groqKey = env.GROQ_API_KEY?.trim();
  if (groqKey) {
    providers.push({
      name: "groq",
      baseUrl: GROQ_BASE_URL,
      apiKey: groqKey,
      model: env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL,
    });
  }

  const geminiKey = env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    providers.push({
      name: "gemini",
      baseUrl: GEMINI_BASE_URL,
      apiKey: geminiKey,
      model: env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
    });
  }

  return providers;
}

// -- Wire types --------------------------------------------------------------

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

/**
 * An assistant message as the provider sent it. Unknown fields are kept
 * (`passthrough`) and echoed back verbatim on the next round, because some
 * providers attach data to tool calls that must be returned unchanged.
 */
const assistantMessageSchema = z
  .object({
    role: z.literal("assistant"),
    content: z.string().nullable().optional(),
    tool_calls: z
      .array(
        z
          .object({
            id: z.string(),
            type: z.literal("function"),
            function: z.object({
              name: z.string(),
              arguments: z.string(),
            }).passthrough(),
          })
          .passthrough()
      )
      .optional(),
  })
  .passthrough();

export type AssistantMessage = z.infer<typeof assistantMessageSchema>;

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | AssistantMessage
  | { role: "tool"; tool_call_id: string; content: string };

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface CompletionRequest {
  messages: readonly ChatMessage[];
  tools: readonly ToolDefinition[];
  /** "none" forces a text answer, e.g. once the tool-round budget is spent. */
  tool_choice?: "auto" | "none";
}

const completionResponseSchema = z.object({
  choices: z
    .array(z.object({ message: assistantMessageSchema }).passthrough())
    .min(1),
});

// -- Errors ------------------------------------------------------------------

/**
 * A provider failure. `retryable` is true for the cases that justify trying
 * the next provider: 429, any 5xx, a timeout, or a network error. Anything
 * else (a 400 for a malformed request, a 401 for a bad key) would fail the
 * same way again, but is still surfaced rather than retried.
 */
export class LlmError extends Error {
  readonly provider: string;
  readonly status: number | null;
  readonly retryable: boolean;
  /** For a 429: how long until the provider's limit clears, when it says. */
  readonly retryAfterMs: number | undefined;

  constructor(
    provider: string,
    message: string,
    status: number | null,
    retryable: boolean,
    retryAfterMs?: number
  ) {
    super(message);
    this.name = "LlmError";
    this.provider = provider;
    this.status = status;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

/** Every configured provider failed. */
export class LlmUnavailableError extends Error {
  readonly failures: readonly LlmError[];

  constructor(failures: readonly LlmError[]) {
    super(
      `All LLM providers failed: ${failures
        .map((failure) => `${failure.provider} (${failure.message})`)
        .join("; ")}`
    );
    this.name = "LlmUnavailableError";
    this.failures = failures;
  }
}

// -- Client ------------------------------------------------------------------

export interface LlmClientOptions {
  providers: readonly LlmProvider[];
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  /** Upper bound on generated tokens per call. */
  maxTokens?: number;
  /** Injectable wait, for the 429 retry in tests. */
  sleep?: (ms: number) => Promise<void>;
}

/** One provider bound to the client's fetch and timeout. */
export type CompleteFn = (request: CompletionRequest) => Promise<AssistantMessage>;

export class LlmClient {
  private readonly providers: readonly LlmProvider[];
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly maxTokens: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: LlmClientOptions) {
    this.providers = options.providers;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxTokens = options.maxTokens ?? 1024;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

    const fetchImpl =
      options.fetchImpl ?? (globalThis.fetch as FetchLike | undefined);
    if (!fetchImpl) {
      throw new Error(
        "No fetch implementation available. Node 18+ or an injected fetchImpl is required."
      );
    }
    this.fetchImpl = fetchImpl;
  }

  get isConfigured(): boolean {
    return this.providers.length > 0;
  }

  /**
   * One /chat/completions call against one provider. A 429 that clears
   * within MAX_RATE_LIMIT_WAIT_MS is waited out and retried once here, so a
   * brief per-minute token limit does not cost a fallback.
   */
  async complete(
    provider: LlmProvider,
    request: CompletionRequest
  ): Promise<AssistantMessage> {
    try {
      return await this.completeOnce(provider, request);
    } catch (error) {
      const waitMs = error instanceof LlmError ? error.retryAfterMs : undefined;
      if (waitMs === undefined || waitMs > MAX_RATE_LIMIT_WAIT_MS) throw error;

      console.info(`${provider.name} 429, retrying in ${(waitMs / 1000).toFixed(1)}s`);
      await this.sleep(waitMs);
      return this.completeOnce(provider, request);
    }
  }

  private async completeOnce(
    provider: LlmProvider,
    request: CompletionRequest
  ): Promise<AssistantMessage> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: provider.model,
          messages: request.messages,
          tools: request.tools,
          tool_choice: request.tool_choice ?? "auto",
          temperature: 0.2,
          max_tokens: this.maxTokens,
          ...(reasoningEffortFor(provider) ? { reasoning_effort: reasoningEffortFor(provider) } : {}),
        }),
        signal: controller.signal,
      });
    } catch (error) {
      const timedOut = controller.signal.aborted;
      throw new LlmError(
        provider.name,
        timedOut
          ? `timed out after ${this.timeoutMs} ms`
          : `network error: ${error instanceof Error ? error.name : "unknown"}`,
        null,
        true
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      // The body is not read: provider error bodies can echo the request.
      throw new LlmError(
        provider.name,
        `HTTP ${response.status}`,
        response.status,
        response.status === 429 || response.status >= 500,
        response.status === 429 ? rateLimitWaitMs(response.headers) : undefined
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new LlmError(provider.name, "response was not JSON", response.status, false);
    }

    const parsed = completionResponseSchema.safeParse(body);
    const message = parsed.success ? parsed.data.choices[0]?.message : undefined;
    if (!message) {
      throw new LlmError(
        provider.name,
        "response had no assistant message",
        response.status,
        false
      );
    }

    return message;
  }

  /**
   * Runs `conversation` against each provider in order until one completes.
   *
   * The whole conversation, tool rounds included, stays on one provider: a
   * retryable failure at any round restarts it from the start on the next
   * provider rather than handing one provider's half-finished tool history
   * to another. Tools are read-only, so re-running them is safe.
   */
  async runWithFallback<T>(
    conversation: (complete: CompleteFn, provider: LlmProvider) => Promise<T>
  ): Promise<T> {
    const failures: LlmError[] = [];

    for (const provider of this.providers) {
      try {
        return await conversation(
          (request) => this.complete(provider, request),
          provider
        );
      } catch (error) {
        if (!(error instanceof LlmError)) {
          throw error;
        }

        console.warn(`LLM provider ${error.provider} failed: ${error.message}`);
        failures.push(error);

        if (!error.retryable) {
          break;
        }
      }
    }

    throw new LlmUnavailableError(failures);
  }
}

/** The client the chat route uses, built from the current environment. */
export function createLlmClientFromEnv(
  env: NodeJS.ProcessEnv = process.env
): LlmClient {
  return new LlmClient({ providers: providersFromEnv(env) });
}
