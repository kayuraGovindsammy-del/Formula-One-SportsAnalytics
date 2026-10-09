import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ChatWidget from "./ChatWidget";
import { API_BASE_URL } from "../../api/submissions";

type FetchResult = { ok: boolean; status: number; json: () => Promise<unknown> };

function reply(text: string): FetchResult {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data: { reply: text, tools_used: [] }, meta: {} }),
  };
}

function failure(status: number, code: string, message: string): FetchResult {
  return { ok: false, status, json: async () => ({ error: { code, message } }) };
}

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<FetchResult>>();

function sentMessages(callIndex = -1) {
  const call = fetchMock.mock.calls.at(callIndex);
  return (JSON.parse(String(call?.[1]?.body)) as { messages: { role: string; content: string }[] })
    .messages;
}

async function openWidget() {
  const user = userEvent.setup();
  render(<ChatWidget />);
  await user.click(screen.getByRole("button", { name: "Open F1 Assistant" }));
  return { user, input: screen.getByRole("textbox", { name: "Ask the F1 Assistant a question" }) };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ChatWidget", () => {
  test("opens from the button, focuses the input, and closes with the button", async () => {
    const { user, input } = await openWidget();

    const dialog = screen.getByRole("dialog", { name: "F1 Assistant" });
    expect(dialog).toHaveAccessibleDescription("Answers use our 2025 data");
    expect(input).toHaveFocus();

    const toggle = screen.getByRole("button", { name: "Close F1 Assistant" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(toggle);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open F1 Assistant" })).toHaveFocus();
  });

  test("closes with Esc and with the header close button, returning focus", async () => {
    const { user } = await openWidget();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open F1 Assistant" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Open F1 Assistant" }));
    await user.click(screen.getByRole("button", { name: "Close chat" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("sends a message, shows the typing state, then the reply", async () => {
    let resolveReply: (value: FetchResult) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise((resolve) => (resolveReply = resolve)));
    const { user, input } = await openWidget();

    await user.type(input, "Who won at Spa?");
    await user.keyboard("{Enter}");

    expect(within(screen.getByRole("log")).getByText("Who won at Spa?")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Assistant is typing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(input).toHaveValue("");

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/chat`,
      expect.objectContaining({ method: "POST" })
    );
    expect(sentMessages()).toEqual([{ role: "user", content: "Who won at Spa?" }]);

    await act(async () => resolveReply(reply("Lando Norris won.")));

    expect(await screen.findByText("Lando Norris won.")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Assistant is typing" })).not.toBeInTheDocument();
  });

  test("Shift+Enter adds a new line instead of sending", async () => {
    const { user, input } = await openWidget();

    await user.type(input, "Line one{Shift>}{Enter}{/Shift}Line two");

    expect(input).toHaveValue("Line one\nLine two");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("a starter question sends straight away", async () => {
    fetchMock.mockResolvedValueOnce(reply("McLaren lead the standings."));
    const { user } = await openWidget();

    await user.click(
      screen.getByRole("button", { name: "Who leads the 2025 constructors standings?" })
    );

    expect(await screen.findByText("McLaren lead the standings.")).toBeInTheDocument();
    expect(sentMessages()).toEqual([
      { role: "user", content: "Who leads the 2025 constructors standings?" },
    ]);
    // Starters only show while the conversation is empty.
    expect(
      screen.queryByRole("button", { name: "How did Oscar Piastri do in 2025?" })
    ).not.toBeInTheDocument();
  });

  test("renders a URL in a reply as a safe link and keeps line breaks", async () => {
    const url = "https://example.test/api/v1/races/2025_R13/events?type=PIT_STOP";
    fetchMock.mockResolvedValueOnce(reply(`Full list:\n${url}.\n<b>not html</b>`));
    const { user, input } = await openWidget();

    await user.type(input, "Pit stops{Enter}");

    const link = await screen.findByRole("link", { name: url });
    expect(link).toHaveAttribute("href", url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    const message = link.parentElement;
    expect(message?.textContent).toContain("Full list:\n");
    // Markup in a reply is shown as text, never rendered.
    expect(message?.querySelector("b")).toBeNull();
    expect(message?.textContent).toContain("<b>not html</b>");
  });

  test("shows the rate-limit message for 429 and keeps the question for a retry", async () => {
    fetchMock
      .mockResolvedValueOnce(failure(429, "RATE_LIMITED", "Too many requests."))
      .mockResolvedValueOnce(reply("Here you go."));
    const { user, input } = await openWidget();

    await user.type(input, "Standings?{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many questions, try again in a minute."
    );
    expect(within(screen.getByRole("log")).getByText("Standings?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Here you go.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(sentMessages()).toEqual([{ role: "user", content: "Standings?" }]);
  });

  test.each([
    [503, "SERVICE_UNAVAILABLE"],
    [502, "BAD_GATEWAY"],
  ])("shows the unavailable message for %i", async (status, code) => {
    fetchMock.mockResolvedValueOnce(failure(status, code, "upstream detail"));
    const { user, input } = await openWidget();

    await user.type(input, "Hello{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The assistant is unavailable right now."
    );
  });

  test("shows a connection message when the server cannot be reached", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { user, input } = await openWidget();

    await user.type(input, "Hello{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the server.");
    expect(within(screen.getByRole("log")).getByText("Hello")).toBeInTheDocument();
  });

  test("does not send an empty or whitespace-only message", async () => {
    const { user, input } = await openWidget();
    const send = screen.getByRole("button", { name: "Send" });

    expect(send).toBeDisabled();
    await user.keyboard("{Enter}");
    await user.type(input, "   ");
    expect(send).toBeDisabled();
    await user.keyboard("{Enter}");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(within(screen.getByRole("log")).queryByText(/\S/, { selector: ".chat-widget__message" }))
      .toBeNull();
  });

  test("sends only the last 10 messages, ending with the user's", async () => {
    fetchMock.mockImplementation(async (_url, init) => {
      const messages = (JSON.parse(String(init?.body)) as { messages: unknown[] }).messages;
      return reply(`Answer ${messages.length}`);
    });
    const { input } = await openWidget();

    // Six questions: the sixth has 11 earlier-or-current turns available.
    for (let question = 1; question <= 6; question += 1) {
      fireEvent.change(input, { target: { value: `Question ${question}` } });
      fireEvent.submit(input.closest("form") as HTMLFormElement);
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(question));
      await screen.findAllByText(/^Answer \d+$/).then((answers) =>
        expect(answers).toHaveLength(question)
      );
    }

    const sent = sentMessages();
    expect(sent).toHaveLength(10);
    expect(sent.at(-1)).toEqual({ role: "user", content: "Question 6" });
    expect(sent.at(0)).toEqual({ role: "assistant", content: "Answer 1" });
    expect(sent.some((message) => message.content === "Question 1")).toBe(false);
  });

  test("the closed launcher is the robot itself, with the same label and no circle", () => {
    render(<ChatWidget />);

    const launcher = screen.getByRole("button", { name: "Open F1 Assistant" });
    expect(launcher.tagName).toBe("BUTTON");
    expect(launcher).toHaveAttribute("aria-expanded", "false");
    expect(launcher).toHaveClass("chat-widget__launcher");
    // The old red circle came from these classes.
    expect(launcher).not.toHaveClass("chat-widget__toggle");
    expect(launcher).not.toHaveClass("chat-widget__toggle--bot");

    const robot = launcher.querySelector("img");
    expect(robot?.getAttribute("src")).toMatch(/f1-assistant-robot-192.*\.webp/);
    expect(robot).toHaveAttribute("alt", "");
    expect(robot).toHaveAttribute("width", "76");
    expect(robot).toHaveAttribute("height", "76");
    expect(launcher.querySelector("svg")).toBeNull();
  });

  test("the open state shows a close button with the right label and keeps the robot", async () => {
    const user = userEvent.setup();
    render(<ChatWidget />);

    await user.click(screen.getByRole("button", { name: "Open F1 Assistant" }));

    const close = screen.getByRole("button", { name: "Close F1 Assistant" });
    expect(close).toHaveAttribute("aria-expanded", "true");
    expect(close.querySelector("svg")).not.toBeNull();
    expect(close.querySelector("img")).toBeNull();

    // The robot perches on the panel, decorative only.
    const perched = document.querySelector(".chat-widget__robot--perched");
    expect(perched?.getAttribute("src")).toMatch(/f1-assistant-robot-192.*\.webp/);
    expect(perched).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).toBeNull();

    // Closing works as before and hands focus back to the launcher.
    await user.click(close);
    expect(screen.getByRole("button", { name: "Open F1 Assistant" })).toHaveFocus();
  });

  test("the panel header shows the small robot beside the title", async () => {
    await openWidget();

    const title = screen.getByRole("heading", { name: "F1 Assistant" });
    const icon = title.closest(".chat-widget__brand")?.querySelector("img");
    expect(icon?.getAttribute("src")).toMatch(/f1-assistant-robot-96.*\.png/);
    expect(icon).toHaveAttribute("alt", "");
    expect(icon).toHaveAttribute("width", "28");
    expect(icon).toHaveAttribute("height", "28");
  });

  test("assistant replies have the small robot avatar and user messages do not", async () => {
    fetchMock.mockResolvedValueOnce(reply("Lando Norris has 394 points."));
    const { user, input } = await openWidget();

    await user.type(input, "Norris points?{Enter}");
    const answer = await screen.findByText("Lando Norris has 394 points.");

    const avatar = answer.closest(".chat-widget__row")?.querySelector("img");
    expect(avatar?.getAttribute("src")).toMatch(/f1-assistant-robot-96.*\.png/);
    expect(avatar).toHaveAttribute("alt", "");
    expect(avatar).toHaveAttribute("width", "24");
    expect(avatar).toHaveAttribute("height", "24");

    const question = within(screen.getByRole("log")).getByText("Norris points?");
    expect(question.closest(".chat-widget__row")).toBeNull();
    expect(question.querySelector("img")).toBeNull();
    expect(screen.getByRole("log").querySelectorAll("img")).toHaveLength(1);
  });

  test("shows a character counter near the 1000-character limit", async () => {
    const { input } = await openWidget();

    fireEvent.change(input, { target: { value: "x".repeat(799) } });
    expect(screen.queryByText("799/1000")).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "x".repeat(950) } });
    expect(screen.getByText("950/1000")).toBeInTheDocument();
    expect(input).toHaveAttribute("maxLength", "1000");
  });
});

describe("ChatWidget speech bubble", () => {
  const bubble = () => document.querySelector(".chat-widget__bubble");

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("appears after 1.5 s, is aria-hidden, and hides when the chat opens", () => {
    render(<ChatWidget />);

    act(() => vi.advanceTimersByTime(1499));
    expect(bubble()).toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(bubble()).toHaveTextContent("Ask me about F1!");
    // Decorative: hidden from assistive technology, and not interactive.
    expect(bubble()).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("button", { name: /Ask me about F1/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open F1 Assistant" }));
    expect(bubble()).toBeNull();

    // Closing again does not bring it back.
    fireEvent.click(screen.getByRole("button", { name: "Close F1 Assistant" }));
    act(() => vi.advanceTimersByTime(10_000));
    expect(bubble()).toBeNull();
  });

  test("hides by itself about 6 s after it appears", () => {
    render(<ChatWidget />);

    act(() => vi.advanceTimersByTime(1500));
    expect(bubble()).not.toBeNull();

    act(() => vi.advanceTimersByTime(5999));
    expect(bubble()).not.toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(bubble()).toBeNull();
  });

  test("never shows if the chat is opened before it appears", () => {
    render(<ChatWidget />);

    fireEvent.click(screen.getByRole("button", { name: "Open F1 Assistant" }));
    act(() => vi.advanceTimersByTime(10_000));

    expect(bubble()).toBeNull();
  });

  test("shows only once: after hiding it does not come back", () => {
    render(<ChatWidget />);

    act(() => vi.advanceTimersByTime(1500));
    expect(bubble()).not.toBeNull();

    act(() => vi.advanceTimersByTime(6000));
    expect(bubble()).toBeNull();

    act(() => vi.advanceTimersByTime(60_000));
    expect(bubble()).toBeNull();
  });
});

describe("ChatWidget slow replies", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function deferredReply() {
    let resolve: (value: FetchResult) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    return (text: string) => resolve(reply(text));
  }

  function send(text: string) {
    const input = screen.getByRole("textbox", { name: "Ask the F1 Assistant a question" });
    fireEvent.change(input, { target: { value: text } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
  }

  test('says "Still working on it…" after 5 s, as a status screen readers announce', async () => {
    const answer = deferredReply();
    render(<ChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Open F1 Assistant" }));
    send("Who won the most races?");

    expect(screen.getByRole("status", { name: "Assistant is typing" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(4999));
    expect(screen.queryByText("Still working on it…")).toBeNull();

    act(() => vi.advanceTimersByTime(1));
    const status = screen.getByRole("status", { name: "Still working on it…" });
    expect(status).toHaveTextContent("Still working on it…");

    await act(async () => answer("Max Verstappen, with 8 wins."));
    expect(screen.getByText("Max Verstappen, with 8 wins.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("resets for the next message", async () => {
    const first = deferredReply();
    render(<ChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Open F1 Assistant" }));
    send("First question");
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByRole("status", { name: "Still working on it…" })).toBeInTheDocument();
    await act(async () => first("First answer."));

    const second = deferredReply();
    send("Second question");

    expect(screen.getByRole("status", { name: "Assistant is typing" })).toBeInTheDocument();
    expect(screen.queryByText("Still working on it…")).toBeNull();
    act(() => vi.advanceTimersByTime(4999));
    expect(screen.queryByText("Still working on it…")).toBeNull();

    await act(async () => second("Second answer."));
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("a quick reply never shows the note", async () => {
    const answer = deferredReply();
    render(<ChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Open F1 Assistant" }));
    send("Quick one");

    act(() => vi.advanceTimersByTime(1200));
    await act(async () => answer("Done."));
    act(() => vi.advanceTimersByTime(10_000));

    expect(screen.queryByText("Still working on it…")).toBeNull();
  });

  test("an error after a slow wait clears the note too", async () => {
    let fail: (value: FetchResult) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise((r) => (fail = r)));
    render(<ChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Open F1 Assistant" }));
    send("Anything");

    act(() => vi.advanceTimersByTime(5000));
    await act(async () => fail(failure(503, "SERVICE_UNAVAILABLE", "x")));

    expect(screen.getByRole("alert")).toHaveTextContent("The assistant is unavailable right now.");
    expect(screen.queryByText("Still working on it…")).toBeNull();

    const retry = deferredReply();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByRole("status", { name: "Assistant is typing" })).toBeInTheDocument();
    await act(async () => retry("Back."));
  });
});

