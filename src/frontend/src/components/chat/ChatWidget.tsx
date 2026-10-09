import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

import { ChatError, MAX_MESSAGE_LENGTH, sendChat, type ChatTurn } from "../../api/chat";
import { linkify } from "./linkify";
import robotImage from "../../assets/chat/f1-assistant-robot-192.webp";
import robotAvatar from "../../assets/chat/f1-assistant-robot-96.png";
import "./ChatWidget.css";

const STARTER_QUESTIONS = [
  "Who leads the 2025 constructors standings?",
  "How did Oscar Piastri do in 2025?",
  "Summarise the pit stops at the Belgian Grand Prix",
] as const;

/** The character counter appears once the message is this long. */
const COUNTER_THRESHOLD = 800;

/** After this long without a reply, the typing indicator says so. */
const SLOW_REPLY_MS = 5000;

/** The "Ask me about F1!" bubble appears this long after load, for this long. */
const BUBBLE_DELAY_MS = 1500;
const BUBBLE_DURATION_MS = 6000;

interface Message extends ChatTurn {
  id: number;
}

function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [slowReply, setSlowReply] = useState(false);

  const nextId = useRef(0);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const openRef = useRef(false);

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

  // Show the speech bubble once, then hide it again. App renders the widget
  // once, outside the routes, so one mount is one page load.
  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const showTimer = setTimeout(() => {
      if (openRef.current) return;
      setBubbleVisible(true);
      hideTimer = setTimeout(() => setBubbleVisible(false), BUBBLE_DURATION_MS);
    }, BUBBLE_DELAY_MS);

    return () => {
      clearTimeout(showTimer);
      if (hideTimer !== undefined) clearTimeout(hideTimer);
    };
  }, []);

  // Read by the bubble timer, which must not show the bubble over an open chat.
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  function openChat() {
    // Opening the chat hides the bubble for good, even if it is reopened later.
    setBubbleVisible(false);
    setOpen(true);
  }

  // A reply that takes a while gets a "Still working on it…" note.
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setSlowReply(true), SLOW_REPLY_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  // Keep the newest message in view.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, pending, error]);

  async function ask(turns: Message[]) {
    setSlowReply(false);
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
    <div className={`chat-widget${open ? " chat-widget--open" : ""}`}>
      {open && (
        <div className="chat-widget__panel-wrap">
          {/* The robot perches on the panel's top-left corner while it is open. */}
          <img
            className="chat-widget__robot chat-widget__robot--perched"
            src={robotImage}
            alt=""
            aria-hidden="true"
            width={56}
            height={56}
          />
          <div
            id={panelId}
            className="chat-widget__panel"
            role="dialog"
            aria-labelledby={titleId}
            aria-describedby={noteId}
            onKeyDown={handlePanelKeyDown}
          >
            <div className="chat-widget__header">
              <div className="chat-widget__brand">
                <img
                  className="chat-widget__header-icon"
                  src={robotAvatar}
                  alt=""
                  width={28}
                  height={28}
                />
                <div>
                  <h2 id={titleId} className="chat-widget__title">
                    F1 Assistant
                  </h2>
                  <p id={noteId} className="chat-widget__note">
                    Answers use our 2025 data
                  </p>
                </div>
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

              {messages.map((message) =>
                message.role === "assistant" ? (
                  <div key={message.id} className="chat-widget__row chat-widget__row--assistant">
                    <img
                      className="chat-widget__avatar"
                      src={robotAvatar}
                      alt=""
                      width={24}
                      height={24}
                    />
                    <div className="chat-widget__message chat-widget__message--assistant">
                      <span className="chat-widget__sr-only">Assistant:</span>
                      {linkify(message.content)}
                    </div>
                  </div>
                ) : (
                  <div key={message.id} className="chat-widget__message chat-widget__message--user">
                    <span className="chat-widget__sr-only">You:</span>
                    {message.content}
                  </div>
                )
              )}

              {pending && (
                <div
                  className={`chat-widget__typing${slowReply ? " chat-widget__typing--slow" : ""}`}
                  role="status"
                  aria-label={slowReply ? "Still working on it…" : "Assistant is typing"}
                >
                  <span className="chat-widget__dot" />
                  <span className="chat-widget__dot" />
                  <span className="chat-widget__dot" />
                  {slowReply && (
                    <span className="chat-widget__typing-text">Still working on it…</span>
                  )}
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
        </div>
      )}

      {bubbleVisible && !open && (
        <div className="chat-widget__bubble" aria-hidden="true">
          Ask me about F1!
        </div>
      )}

      {open ? (
        <button
          ref={toggleRef}
          type="button"
          className="chat-widget__toggle"
          aria-label="Close F1 Assistant"
          aria-expanded={true}
          aria-controls={panelId}
          onClick={() => setOpen(false)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      ) : (
        // The robot itself is the launcher: labelled, so the image is decorative.
        <button
          ref={toggleRef}
          type="button"
          className="chat-widget__launcher"
          aria-label="Open F1 Assistant"
          aria-expanded={false}
          onClick={openChat}
        >
          <img className="chat-widget__robot" src={robotImage} alt="" width={76} height={76} />
        </button>
      )}
    </div>
  );
}

export default ChatWidget;
