import { API_BASE_URL } from "./submissions";

export type ChatRole = "user" | "assistant";

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface ChatReply {
  reply: string;
  tools_used: string[];
}

/** POST /chat accepts at most this many messages per request. */
export const MAX_HISTORY = 10;

/** POST /chat rejects any message longer than this. */
export const MAX_MESSAGE_LENGTH = 1000;

/** A failed chat request, with text that is safe to show the user. */
export class ChatError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "ChatError";
    this.status = status;
  }
}

function friendlyMessage(status: number, body: unknown): string {
  if (status === 429) return "Too many questions, try again in a minute.";
  if (status === 502 || status === 503) return "The assistant is unavailable right now.";

  const error = (body as { error?: { message?: unknown } } | null)?.error;
  return typeof error?.message === "string"
    ? error.message
    : "Something went wrong. Please try again.";
}

/**
 * The messages to send: the last MAX_HISTORY turns, ending with a user turn.
 * Earlier assistant replies are cut to MAX_MESSAGE_LENGTH, since the API
 * validates every message's length, not just the user's.
 */
export function historyForRequest(turns: readonly ChatTurn[]): ChatTurn[] {
  let end = turns.length;
  while (end > 0 && turns[end - 1]?.role !== "user") end -= 1;

  return turns
    .slice(0, end)
    .slice(-MAX_HISTORY)
    .map((turn) => ({
      role: turn.role,
      content: turn.content.trim().slice(0, MAX_MESSAGE_LENGTH),
    }));
}

/** Sends the conversation to POST /chat and returns the assistant's reply. */
export async function sendChat(turns: readonly ChatTurn[]): Promise<ChatReply> {
  const messages = historyForRequest(turns);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
  } catch {
    throw new ChatError("Can't reach the server. Check your connection and try again.", null);
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ChatError(friendlyMessage(response.status, body), response.status);
  }

  const data = (body as { data?: Partial<ChatReply> } | null)?.data;
  if (typeof data?.reply !== "string") {
    throw new ChatError("Something went wrong. Please try again.", response.status);
  }

  return { reply: data.reply, tools_used: data.tools_used ?? [] };
}
