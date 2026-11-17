import type { ChatTurnResult, DocumentState, DocumentValues } from "./documents";

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

/** An API error, with the HTTP status (e.g. 401 when not signed in). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // "include" sends the HttpOnly session cookie, also from the dev server.
  const response = await fetch(`${API_URL}${path}`, { credentials: "include", ...init });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = typeof body?.detail === "string" ? body.detail : null;
    throw new ApiError(detail ?? "Something went wrong. Please try again.", response.status);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

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
  return request<ChatTurn>(
    "/api/chat/message",
    json("POST", { messages, documentType: document.type, fields: document.values, today }),
  );
}

export interface User {
  id: number;
  name: string;
  email: string;
}

/** The signed-in user, or null for a guest. */
export async function getCurrentUser(): Promise<User | null> {
  try {
    return await request<User>("/api/auth/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export function signUp(name: string, email: string, password: string): Promise<User> {
  return request<User>("/api/auth/signup", json("POST", { name, email, password }));
}

export function signIn(email: string, password: string): Promise<User> {
  return request<User>("/api/auth/signin", json("POST", { email, password }));
}

export function signOut(): Promise<void> {
  return request<void>("/api/auth/signout", { method: "POST" });
}

export interface DocumentSummary {
  id: number;
  documentType: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedDocument extends DocumentSummary {
  fields: DocumentValues;
  messages: ChatMessage[];
}

export interface DocumentInput {
  documentType: string;
  title: string;
  fields: DocumentValues;
  messages: ChatMessage[];
}

export function listDocuments(): Promise<DocumentSummary[]> {
  return request<DocumentSummary[]>("/api/documents");
}

export function getDocument(id: number): Promise<SavedDocument> {
  return request<SavedDocument>(`/api/documents/${id}`);
}

/** Creates the document, or updates it when `id` is given. */
export function saveDocument(input: DocumentInput, id?: number): Promise<SavedDocument> {
  return id === undefined
    ? request<SavedDocument>("/api/documents", json("POST", input))
    : request<SavedDocument>(`/api/documents/${id}`, json("PUT", input));
}

export function deleteDocument(id: number): Promise<void> {
  return request<void>(`/api/documents/${id}`, { method: "DELETE" });
}
