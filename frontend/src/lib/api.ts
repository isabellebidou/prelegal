import type { ChatTurnResult, DocumentState } from "./documents";

/**
 * The backend's base URL. Empty in production, where the backend serves the
 * frontend; set NEXT_PUBLIC_API_URL=http://localhost:8000 for `npm run dev`.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatTurn extends ChatTurnResult {
  reply: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = typeof body?.detail === "string" ? body.detail : null;
    throw new Error(detail ?? "Something went wrong. Please try again.");
  }
  return response.json();
}

export async function getGreeting(): Promise<string> {
  const { reply } = await request<{ reply: string }>("/api/chat/greeting");
  return reply;
}

/**
 * Sends the conversation and the current document; returns the AI's reply,
 * the document type it is working on (null until chosen) and its fields.
 */
export function sendChatMessage(
  messages: ChatMessage[],
  document: DocumentState,
  today: string,
): Promise<ChatTurn> {
  return request<ChatTurn>("/api/chat/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      documentType: document.type,
      fields: document.values,
      today,
    }),
  });
}
