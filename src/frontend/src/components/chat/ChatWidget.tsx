import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

import { ChatError, MAX_MESSAGE_LENGTH, sendChat, type ChatTurn } from "../../api/chat";
import { linkify } from "./linkify";
import "./ChatWidget.css";

const STARTER_QUESTIONS = [
  "Who leads the 2025 constructors standings?",
  "How did Oscar Piastri do in 2025?",
  "Summarise the pit stops at the Belgian Grand Prix",
] as const;

/** The character counter appears once the message is this long. */
const COUNTER_THRESHOLD = 800;

interface Message extends ChatTurn {
  id: number;
}

function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextId = useRef(0);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  const panelId = useId();
  const titleId = useId();
  const noteId = useId();

  // Focus the input on open and return it to the toggle on close.
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else if (wasOpen.current) {
      toggleRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  // Keep the newest message in view.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, pending, error]);

  async function ask(turns: Message[]) {
    setPending(true);
    setError(null);

    try {
      const { reply } = await sendChat(turns);
      setMessages([...turns, { id: nextId.current++, role: "assistant", content: reply }]);
    } catch (caught) {
      // The user's message stays in the list so it can be retried.
      setError(
        caught instanceof ChatError ? caught.message : "Something went wrong. Please try again."
      );
    } finally {
      setPending(false);
    }
  }

  function send(text: string) {
    const content = text.trim();
    if (content === "" || pending) return;

    const turns = [...messages, { id: nextId.current++, role: "user" as const, content }];
    setMessages(turns);
    setDraft("");
    void ask(turns);
  }

  function retry() {
    if (!pending && messages.at(-1)?.role === "user") void ask(messages);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(draft);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter (and Enter while composing text) adds a line.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(draft);
    }
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      setOpen(false);
    }
  }

  const canSend = draft.trim() !== "" && !pending;
  const showCounter = draft.length >= COUNTER_THRESHOLD;

  return (
    <div className="chat-widget">
      {open && (
        <div
          id={panelId}
          className="chat-widget__panel"
          role="dialog"
          aria-labelledby={titleId}
          aria-describedby={noteId}
          onKeyDown={handlePanelKeyDown}
        >
          <div className="chat-widget__header">
            <div>
              <h2 id={titleId} className="chat-widget__title">
                F1 Assistant
              </h2>
              <p id={noteId} className="chat-widget__note">
                Answers use our 2025 data
              </p>
            </div>
            <button
              type="button"
              className="chat-widget__close"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>

          <div
            ref={listRef}
            className="chat-widget__messages"
            role="log"
            aria-live="polite"
            aria-label="Conversation"
          >
            {messages.length === 0 && !pending && (
              <div className="chat-widget__starters">
                <p className="chat-widget__hint">Try asking:</p>
                {STARTER_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    className="chat-widget__starter"
                    onClick={() => send(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`chat-widget__message chat-widget__message--${message.role}`}
              >
                <span className="chat-widget__sr-only">
                  {message.role === "user" ? "You:" : "Assistant:"}
                </span>
                {message.role === "assistant" ? linkify(message.content) : message.content}
              </div>
            ))}

            {pending && (
              <div className="chat-widget__typing" role="status" aria-label="Assistant is typing">
                <span />
                <span />
                <span />
              </div>
            )}

            {error && (
              <div className="chat-widget__error" role="alert">
                <span>{error}</span>
                <button type="button" className="chat-widget__retry" onClick={retry}>
                  Retry
                </button>
              </div>
            )}
          </div>

          <form className="chat-widget__form" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              className="chat-widget__input"
              aria-label="Ask the F1 Assistant a question"
              placeholder="Ask about drivers, teams or races…"
              rows={2}
              maxLength={MAX_MESSAGE_LENGTH}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleInputKeyDown}
            />
            <div className="chat-widget__actions">
              {showCounter && (
                <span className="chat-widget__counter" aria-live="polite">
                  {draft.length}/{MAX_MESSAGE_LENGTH}
                </span>
              )}
              <button type="submit" className="chat-widget__send" disabled={!canSend}>
                Send
              </button>
            </div>
          </form>
        </div>
      )}

      <button
        ref={toggleRef}
        type="button"
        className="chat-widget__toggle"
        aria-label={open ? "Close F1 Assistant" : "Open F1 Assistant"}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 5h16v11H9l-5 4z" />
          )}
        </svg>
      </button>
    </div>
  );
}

export default ChatWidget;
