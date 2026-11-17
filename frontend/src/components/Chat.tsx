"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getGreeting, sendChatMessage, type ChatMessage } from "@/lib/api";
import { applyTurn, type DocumentState } from "@/lib/documents";
import styles from "./Chat.module.css";

/** Today's date as YYYY-MM-DD in the user's local time zone. */
function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

interface ChatProps {
  state: DocumentState;
  /** Receives an updater that applies the AI's answer to the current document. */
  onStateChange: (update: (current: DocumentState) => DocumentState) => void;
  /** The conversation, kept by the parent so it can be saved and restored. */
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
}

/**
 * Freeform chat with the AI, which picks the document type and fills in its
 * fields as it goes. Starts with the AI's greeting when the conversation is
 * empty. Give it a new `key` to start another conversation.
 */
export default function Chat({ state, onStateChange, messages, onMessagesChange: setMessages }: ChatProps) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  // False once this conversation is replaced (e.g. New document), so a late
  // AI answer is not applied to the next document.
  const alive = useRef(true);
  const startedEmpty = useRef(messages.length === 0);

  useEffect(() => {
    alive.current = true;
    if (startedEmpty.current) {
      getGreeting()
        .then((reply) => alive.current && setMessages([{ role: "assistant", content: reply }]))
        .catch((err: Error) => alive.current && setError(err.message));
    }
    return () => {
      alive.current = false;
    };
    // Only on mount: a restored conversation has no greeting to fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the newest message in view.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, pending]);

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || pending) return;

    const withUser: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(withUser);
    setDraft("");
    setError("");
    setPending(true);
    try {
      const sent = state;
      const turn = await sendChatMessage(withUser, sent, localToday());
      if (!alive.current) return;
      setMessages([...withUser, { role: "assistant", content: turn.reply }]);
      // The form may have been edited while waiting; keep those edits.
      onStateChange((current) => applyTurn(current, sent, turn));
    } catch (err) {
      if (!alive.current) return;
      // Put the message back so the user can resend it.
      setMessages(messages);
      setDraft(text);
      setError((err as Error).message);
    } finally {
      if (alive.current) {
        setPending(false);
        inputRef.current?.focus();
      }
    }
  };

  return (
    <div className={styles.chat}>
      <div ref={logRef} className={styles.log} role="log" aria-label="Conversation">
        {messages.map((message, i) =>
          message.role === "user" ? (
            <p key={i} className={styles.user}>
              {message.content}
            </p>
          ) : (
            // The AI may format with markdown (lists, bold). Raw HTML is not rendered.
            <div key={i} className={styles.assistant}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          ),
        )}
        {pending && <p className={`${styles.assistant} ${styles.typing}`}>Thinking...</p>}
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <form className={styles.composer} onSubmit={send}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type your answer..."
          aria-label="Message"
          autoFocus
        />
        <button type="submit" disabled={pending || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
