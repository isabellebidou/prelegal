import type { NdaFormValues } from "./nda";

/**
 * The backend's base URL. Empty in production, where the backend serves the
 * frontend; set NEXT_PUBLIC_API_URL=http://localhost:8000 for `npm run dev`.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatTurn {
  reply: string;
  fields: NdaFormValues;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? "Something went wrong. Please try again.");
  }
  return response.json();
}

export async function getGreeting(): Promise<string> {
  const { reply } = await request<{ reply: string }>("/api/chat/greeting");
  return reply;
}

/** Sends the conversation and current fields; returns the AI's reply and updated fields. */
export function sendChatMessage(
  messages: ChatMessage[],
  fields: NdaFormValues,
  today: string,
): Promise<ChatTurn> {
  return request<ChatTurn>("/api/chat/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, fields, today }),
  });
}
