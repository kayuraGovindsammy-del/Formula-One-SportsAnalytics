import { afterEach, describe, expect, test, vi } from "vitest";

import { ChatError, historyForRequest, sendChat, type ChatTurn } from "./chat";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("historyForRequest", () => {
  test("keeps the last 10 turns", () => {
    const turns: ChatTurn[] = Array.from({ length: 13 }, (_, n) => ({
      role: n % 2 === 0 ? "user" : "assistant",
      content: `turn ${n}`,
    }));

    const history = historyForRequest(turns);

    expect(history).toHaveLength(10);
    expect(history.at(0)?.content).toBe("turn 3");
    expect(history.at(-1)).toEqual({ role: "user", content: "turn 12" });
  });

  test("never ends on an assistant turn", () => {
    expect(
      historyForRequest([
        { role: "user", content: "q" },
        { role: "assistant", content: "a" },
      ])
    ).toEqual([{ role: "user", content: "q" }]);
  });

  test("cuts earlier assistant replies to the API's 1000-character limit", () => {
    const history = historyForRequest([
      { role: "user", content: "q1" },
      { role: "assistant", content: "a".repeat(1500) },
      { role: "user", content: "q2" },
    ]);

    expect(history[1]?.content).toHaveLength(1000);
  });
});

describe("sendChat", () => {
  test("uses the API's error message for other failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { code: "VALIDATION_ERROR", message: "messages: too long" } }),
      })
    );

    await expect(sendChat([{ role: "user", content: "hi" }])).rejects.toEqual(
      new ChatError("messages: too long", 400)
    );
  });

  test("rejects a successful response without a reply", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: {} }) })
    );

    await expect(sendChat([{ role: "user", content: "hi" }])).rejects.toBeInstanceOf(ChatError);
  });
});
