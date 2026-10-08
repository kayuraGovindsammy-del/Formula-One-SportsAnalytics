import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GROQ_MODEL,
  GEMINI_BASE_URL,
  GROQ_BASE_URL,
  LlmClient,
  LlmError,
  LlmUnavailableError,
  providersFromEnv,
  rateLimitWaitMs,
  reasoningEffortFor,
  type CompletionRequest,
  type FetchLike,
  type LlmProvider,
} from "./llmClient.js";

const groq: LlmProvider = {
  name: "groq",
  baseUrl: GROQ_BASE_URL,
  apiKey: "groq-secret-key",
  model: "groq-model",
};

const gemini: LlmProvider = {
  name: "gemini",
  baseUrl: GEMINI_BASE_URL,
  apiKey: "gemini-secret-key",
  model: "gemini-model",
};

const request: CompletionRequest = {
  messages: [{ role: "user", content: "Who won the 2025 Austrian GP?" }],
  tools: [],
};

interface RecordedCall {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function completion(message: Record<string, unknown>): Response {
  return jsonResponse(200, { choices: [{ index: 0, message }] });
}

/** Serves the given responses in order and records every request. */
function scriptedFetch(responses: Array<() => Response | Promise<Response>>) {
  const calls: RecordedCall[] = [];
  let index = 0;

  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({
      url,
      headers: init?.headers as Record<string, string>,
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    const next = responses[index++];
    if (!next) throw new Error(`Unexpected request #${index}`);
    return next();
  };

  return { fetchImpl, calls };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("providersFromEnv", () => {
  it("returns no providers when neither key is set", () => {
    expect(providersFromEnv({})).toEqual([]);
    expect(providersFromEnv({ GROQ_API_KEY: "  ", GEMINI_API_KEY: "" })).toEqual([]);
  });

  it("orders Groq before Gemini and applies the default models", () => {
    const providers = providersFromEnv({
      GROQ_API_KEY: "g",
      GEMINI_API_KEY: "m",
    });

    expect(providers.map((provider) => [provider.name, provider.model])).toEqual([
      ["groq", DEFAULT_GROQ_MODEL],
      ["gemini", DEFAULT_GEMINI_MODEL],
    ]);
  });

  it("honours GROQ_MODEL and GEMINI_MODEL overrides", () => {
    const providers = providersFromEnv({
      GROQ_API_KEY: "g",
      GROQ_MODEL: "openai/gpt-oss-120b",
      GEMINI_API_KEY: "m",
      GEMINI_MODEL: "gemini-3.8-flash",
    });

    expect(providers.map((provider) => provider.model)).toEqual([
      "openai/gpt-oss-120b",
      "gemini-3.8-flash",
    ]);
  });
});

describe("LlmClient.complete", () => {
  it("returns a plain text reply", async () => {
    const { fetchImpl, calls } = scriptedFetch([
      () => completion({ role: "assistant", content: "Lando Norris won." }),
    ]);
    const client = new LlmClient({ providers: [groq], fetchImpl });

    const message = await client.complete(groq, request);

    expect(message.content).toBe("Lando Norris won.");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${GROQ_BASE_URL}/chat/completions`);
    expect(calls[0]?.headers.Authorization).toBe("Bearer groq-secret-key");
    expect(calls[0]?.body).toMatchObject({
      model: "groq-model",
      messages: request.messages,
      tool_choice: "auto",
    });
  });

  it("returns tool calls and keeps provider-specific fields for the echo", async () => {
    const { fetchImpl } = scriptedFetch([
      () =>
        completion({
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: {
                name: "get_driver_stats",
                arguments: '{"driver_id":"NOR"}',
              },
              extra_content: { google: { thought_signature: "sig" } },
            },
          ],
        }),
    ]);
    const client = new LlmClient({ providers: [groq], fetchImpl });

    const message = await client.complete(groq, request);

    expect(message.tool_calls).toEqual([
      {
        id: "call_1",
        type: "function",
        function: { name: "get_driver_stats", arguments: '{"driver_id":"NOR"}' },
        extra_content: { google: { thought_signature: "sig" } },
      },
    ]);
  });

  it("marks 429 and 5xx as retryable, other 4xx as not", async () => {
    for (const [status, retryable] of [
      [429, true],
      [500, true],
      [503, true],
      [400, false],
      [401, false],
    ] as const) {
      const { fetchImpl } = scriptedFetch([() => jsonResponse(status, {})]);
      const client = new LlmClient({ providers: [groq], fetchImpl });

      const error = await client.complete(groq, request).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(LlmError);
      expect(error).toMatchObject({ status, retryable });
    }
  });

  it("aborts a call that exceeds the timeout", async () => {
    const fetchImpl: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError"))
        );
      });
    const client = new LlmClient({ providers: [groq], fetchImpl, timeoutMs: 20 });

    const error = await client.complete(groq, request).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(LlmError);
    expect(error).toMatchObject({
      provider: "groq",
      status: null,
      retryable: true,
      message: "timed out after 20 ms",
    });
  });

  it("rejects a response without an assistant message", async () => {
    const { fetchImpl } = scriptedFetch([() => jsonResponse(200, { choices: [] })]);
    const client = new LlmClient({ providers: [groq], fetchImpl });

    await expect(client.complete(groq, request)).rejects.toMatchObject({
      retryable: false,
    });
  });
});

describe("LlmClient.runWithFallback", () => {
  it("falls back to Gemini when Groq answers 429", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fetchImpl, calls } = scriptedFetch([
      () => jsonResponse(429, { error: { message: "rate limited" } }),
      () => completion({ role: "assistant", content: "From Gemini." }),
    ]);
    const client = new LlmClient({ providers: [groq, gemini], fetchImpl });

    const result = await client.runWithFallback(async (complete, provider) => ({
      provider: provider.name,
      message: await complete(request),
    }));

    expect(result.provider).toBe("gemini");
    expect(result.message.content).toBe("From Gemini.");
    expect(calls.map((call) => call.url)).toEqual([
      `${GROQ_BASE_URL}/chat/completions`,
      `${GEMINI_BASE_URL}/chat/completions`,
    ]);
    expect(calls[1]?.headers.Authorization).toBe("Bearer gemini-secret-key");
  });

  it("falls back to Gemini when Groq times out", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let call = 0;
    const fetchImpl: FetchLike = (_url, init) => {
      call += 1;
      if (call === 1) {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError"))
          );
        });
      }
      return Promise.resolve(completion({ role: "assistant", content: "ok" }));
    };
    const client = new LlmClient({
      providers: [groq, gemini],
      fetchImpl,
      timeoutMs: 20,
    });

    const reply = await client.runWithFallback((complete) => complete(request));

    expect(reply.content).toBe("ok");
    expect(call).toBe(2);
  });

  it("restarts the whole conversation on the fallback provider", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fetchImpl, calls } = scriptedFetch([
      () => completion({ role: "assistant", content: "round 1 on groq" }),
      () => jsonResponse(503, {}),
      () => completion({ role: "assistant", content: "round 1 on gemini" }),
      () => completion({ role: "assistant", content: "round 2 on gemini" }),
    ]);
    const client = new LlmClient({ providers: [groq, gemini], fetchImpl });

    const replies = await client.runWithFallback(async (complete) => [
      (await complete(request)).content,
      (await complete(request)).content,
    ]);

    expect(replies).toEqual(["round 1 on gemini", "round 2 on gemini"]);
    expect(calls).toHaveLength(4);
  });

  it("does not fall back on a non-retryable error", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fetchImpl, calls } = scriptedFetch([() => jsonResponse(401, {})]);
    const client = new LlmClient({ providers: [groq, gemini], fetchImpl });

    await expect(
      client.runWithFallback((complete) => complete(request))
    ).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(calls).toHaveLength(1);
  });

  it("throws LlmUnavailableError when every provider fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fetchImpl } = scriptedFetch([
      () => jsonResponse(500, {}),
      () => jsonResponse(429, {}),
    ]);
    const client = new LlmClient({ providers: [groq, gemini], fetchImpl });

    const error = await client
      .runWithFallback((complete) => complete(request))
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(LlmUnavailableError);
    expect((error as LlmUnavailableError).failures.map((f) => f.status)).toEqual([
      500, 429,
    ]);
  });

  it("is unconfigured, and fails without a request, when no keys are set", async () => {
    const fetchImpl = vi.fn<FetchLike>();
    const client = new LlmClient({ providers: providersFromEnv({}), fetchImpl });

    expect(client.isConfigured).toBe(false);
    await expect(
      client.runWithFallback((complete) => complete(request))
    ).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never puts an API key or the prompt in errors or logs", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fetchImpl } = scriptedFetch([
      () => jsonResponse(500, { echoed: "groq-secret-key Who won" }),
      () => jsonResponse(500, {}),
    ]);
    const client = new LlmClient({ providers: [groq, gemini], fetchImpl });

    const error = await client
      .runWithFallback((complete) => complete(request))
      .catch((e: unknown) => e);

    const logged = warn.mock.calls.flat().join(" ");
    for (const text of [String((error as Error).message), logged]) {
      expect(text).not.toContain("secret-key");
      expect(text).not.toContain("Who won");
    }
  });
});

describe("reasoning effort", () => {
  it("asks Groq's gpt-oss for low effort and Gemini for the least it supports", () => {
    expect(reasoningEffortFor({ ...groq, model: "openai/gpt-oss-20b" })).toBe("low");
    expect(reasoningEffortFor({ ...groq, model: "openai/gpt-oss-120b" })).toBe("low");
    expect(reasoningEffortFor({ ...gemini, model: "gemini-3.5-flash-lite" })).toBe("minimal");
    expect(reasoningEffortFor({ ...gemini, model: "gemini-3.8-flash" })).toBe("minimal");
    expect(reasoningEffortFor({ ...gemini, model: "gemini-2.5-flash-lite" })).toBe("none");
  });

  it("sends nothing for models that may not support it", () => {
    expect(reasoningEffortFor({ ...groq, model: "llama-3.3-70b-versatile" })).toBeUndefined();
    expect(reasoningEffortFor({ ...gemini, model: "gemini-2.5-pro" })).toBeUndefined();
  });

  it("puts reasoning_effort in the request body for each provider", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fetchImpl, calls } = scriptedFetch([
      () => jsonResponse(500, {}),
      () => completion({ role: "assistant", content: "ok" }),
    ]);
    const client = new LlmClient({
      providers: [
        { ...groq, model: "openai/gpt-oss-20b" },
        { ...gemini, model: "gemini-3.5-flash-lite" },
      ],
      fetchImpl,
    });

    await client.runWithFallback((complete) => complete(request));

    expect(calls[0]?.body.reasoning_effort).toBe("low");
    expect(calls[1]?.body.reasoning_effort).toBe("minimal");
  });

  it("leaves reasoning_effort out when the model has none", async () => {
    const { fetchImpl, calls } = scriptedFetch([
      () => completion({ role: "assistant", content: "ok" }),
    ]);
    const client = new LlmClient({ providers: [groq], fetchImpl });

    await client.complete(groq, request);

    expect(calls[0]?.body).not.toHaveProperty("reasoning_effort");
  });
});

describe("rateLimitWaitMs", () => {
  const headers = (values: Record<string, string>) => new Headers(values);

  it("prefers retry-after, in seconds", () => {
    expect(rateLimitWaitMs(headers({ "retry-after": "2", "x-ratelimit-reset-tokens": "9s" }))).toBe(2000);
    expect(rateLimitWaitMs(headers({ "retry-after": "1.5" }))).toBe(1500);
  });

  it("reads Groq's x-ratelimit-reset-tokens durations", () => {
    expect(rateLimitWaitMs(headers({ "x-ratelimit-reset-tokens": "7.66s" }))).toBe(7660);
    expect(rateLimitWaitMs(headers({ "x-ratelimit-reset-tokens": "1m2.5s" }))).toBe(62_500);
    expect(rateLimitWaitMs(headers({ "x-ratelimit-reset-tokens": "250ms" }))).toBe(250);
    expect(rateLimitWaitMs(headers({ "x-ratelimit-reset-tokens": "2m59.56s" }))).toBeCloseTo(179_560);
  });

  it("is undefined when there is nothing it can read", () => {
    expect(rateLimitWaitMs(headers({}))).toBeUndefined();
    expect(rateLimitWaitMs(headers({ "x-ratelimit-reset-tokens": "soon" }))).toBeUndefined();
  });
});

describe("429 handling", () => {
  function setup(responses: Array<() => Response>) {
    const { fetchImpl, calls } = scriptedFetch(responses);
    const sleep = vi.fn(async () => {});
    const client = new LlmClient({ providers: [groq, gemini], fetchImpl, sleep });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    return { client, calls, sleep, info };
  }

  it("waits out a short 429 and retries Groq once, without falling back", async () => {
    const { client, calls, sleep, info } = setup([
      () => jsonResponse(429, {}, { "retry-after": "2" }),
      () => completion({ role: "assistant", content: "from groq" }),
    ]);

    const reply = await client.runWithFallback((complete) => complete(request));

    expect(reply.content).toBe("from groq");
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(info).toHaveBeenCalledWith("groq 429, retrying in 2.0s");
    expect(calls.map((call) => call.url)).toEqual([
      `${GROQ_BASE_URL}/chat/completions`,
      `${GROQ_BASE_URL}/chat/completions`,
    ]);
  });

  it("uses x-ratelimit-reset-tokens when there is no retry-after", async () => {
    const { client, sleep } = setup([
      () => jsonResponse(429, {}, { "x-ratelimit-reset-tokens": "1.25s" }),
      () => completion({ role: "assistant", content: "ok" }),
    ]);

    await client.runWithFallback((complete) => complete(request));

    expect(sleep).toHaveBeenCalledWith(1250);
  });

  it("falls back straight away when the wait is longer than 3 s", async () => {
    const { client, calls, sleep } = setup([
      () => jsonResponse(429, {}, { "retry-after": "10", "x-ratelimit-reset-tokens": "49.97s" }),
      () => completion({ role: "assistant", content: "from gemini" }),
    ]);

    const reply = await client.runWithFallback((complete) => complete(request));

    expect(reply.content).toBe("from gemini");
    expect(sleep).not.toHaveBeenCalled();
    expect(calls[1]?.url).toBe(`${GEMINI_BASE_URL}/chat/completions`);
  });

  it("retries only once, then falls back", async () => {
    const { client, calls, sleep } = setup([
      () => jsonResponse(429, {}, { "retry-after": "1" }),
      () => jsonResponse(429, {}, { "retry-after": "1" }),
      () => completion({ role: "assistant", content: "from gemini" }),
    ]);

    const reply = await client.runWithFallback((complete) => complete(request));

    expect(reply.content).toBe("from gemini");
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(calls.map((call) => call.url)).toEqual([
      `${GROQ_BASE_URL}/chat/completions`,
      `${GROQ_BASE_URL}/chat/completions`,
      `${GEMINI_BASE_URL}/chat/completions`,
    ]);
  });

  it("falls back on a 429 without any timing headers", async () => {
    const { client, sleep, calls } = setup([
      () => jsonResponse(429, {}),
      () => completion({ role: "assistant", content: "from gemini" }),
    ]);

    await client.runWithFallback((complete) => complete(request));

    expect(sleep).not.toHaveBeenCalled();
    expect(calls).toHaveLength(2);
  });
});
