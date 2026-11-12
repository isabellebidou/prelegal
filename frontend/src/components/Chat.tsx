"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getGreeting, sendChatMessage, type ChatMessage } from "@/lib/api";
import { mergeAiChanges, type NdaFormValues } from "@/lib/nda";
import styles from "./Chat.module.css";

/** Today's date as YYYY-MM-DD in the user's local time zone. */
function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

interface ChatProps {
  values: NdaFormValues;
  /** Receives an updater that applies the AI's changes to the current fields. */
  onFieldsChange: (update: (current: NdaFormValues) => NdaFormValues) => void;
}

/** Freeform chat with the AI, which fills in the NDA fields as it goes. */
export default function Chat({ values, onFieldsChange }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getGreeting()
      .then((reply) => !cancelled && setMessages([{ role: "assistant", content: reply }]))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
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
      const sent = values;
      const turn = await sendChatMessage(withUser, sent, localToday());
      setMessages([...withUser, { role: "assistant", content: turn.reply }]);
      // The form may have been edited while waiting; keep those edits.
      onFieldsChange((current) => mergeAiChanges(current, sent, turn.fields));
    } catch (err) {
      // Put the message back so the user can resend it.
      setMessages(messages);
      setDraft(text);
      setError((err as Error).message);
    } finally {
      setPending(false);
      inputRef.current?.focus();
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
