/**
 * The draft being worked on: the document, its chat and, once saved, its id
 * on the user's account. Unsaved changes are found by comparing snapshots.
 */

import type { ChatMessage } from "./api";
import type { DocumentState } from "./documents";

export interface Draft {
  document: DocumentState;
  messages: ChatMessage[];
}

export function snapshot(draft: Draft): string {
  return JSON.stringify(draft);
}

/** "Nov 17, 2026, 2:05 PM" in local time, for SQLite's UTC "YYYY-MM-DD HH:MM:SS". */
export function formatSavedAt(timestamp: string, locale?: string): string {
  const date = new Date(`${timestamp.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat(locale ?? "en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
