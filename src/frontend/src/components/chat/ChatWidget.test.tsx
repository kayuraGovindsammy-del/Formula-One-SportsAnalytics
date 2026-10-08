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

  test("the closed button shows the bot icon; the open button shows the close icon", async () => {
    const user = userEvent.setup();
    render(<ChatWidget />);

    const closed = screen.getByRole("button", { name: "Open F1 Assistant" });
    const icon = closed.querySelector("img");
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("src")).toMatch(/f1-assistant-bot-256.*\.webp/);
    expect(icon).toHaveAttribute("alt", "");
    expect(icon).toHaveAttribute("width", "56");
    expect(icon).toHaveAttribute("height", "56");
    expect(closed.querySelector("svg")).toBeNull();

    await user.click(closed);

    const open = screen.getByRole("button", { name: "Close F1 Assistant" });
    expect(open.querySelector("img")).toBeNull();
    expect(open.querySelector("svg")).not.toBeNull();
    // The image is decorative: the buttons' names are still their aria-labels.
    expect(screen.queryByRole("img")).toBeNull();
  });

  test("the panel header shows the bot icon beside the title", async () => {
    await openWidget();

    const title = screen.getByRole("heading", { name: "F1 Assistant" });
    const icon = title.closest(".chat-widget__brand")?.querySelector("img");
    expect(icon?.getAttribute("src")).toMatch(/f1-assistant-bot-96.*\.png/);
    expect(icon).toHaveAttribute("alt", "");
    expect(icon).toHaveAttribute("width", "28");
    expect(icon).toHaveAttribute("height", "28");
  });

  test("assistant replies have a bot avatar and user messages do not", async () => {
    fetchMock.mockResolvedValueOnce(reply("Lando Norris has 394 points."));
    const { user, input } = await openWidget();

    await user.type(input, "Norris points?{Enter}");
    const answer = await screen.findByText("Lando Norris has 394 points.");

    const avatar = answer.closest(".chat-widget__row")?.querySelector("img");
    expect(avatar?.getAttribute("src")).toMatch(/f1-assistant-bot-96.*\.png/);
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
