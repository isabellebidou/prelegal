import { describe, expect, it } from "vitest";
import { NO_DOCUMENT } from "./documents";
import { defaultNdaFormValues } from "./nda";
import { formatSavedAt, snapshot } from "./session";

describe("snapshot", () => {
  const draft = {
    document: { type: "mutual-nda", values: defaultNdaFormValues },
    messages: [{ role: "assistant" as const, content: "Hi" }],
  };

  it("is equal for equal drafts", () => {
    expect(snapshot(draft)).toBe(snapshot(structuredClone(draft)));
  });

  it("changes when the fields or the chat change", () => {
    const edited = { ...draft, document: { type: "mutual-nda", values: { ...defaultNdaFormValues, purpose: "x" } } };
    const chatted = { ...draft, messages: [...draft.messages, { role: "user" as const, content: "Hello" }] };
    expect(snapshot(edited)).not.toBe(snapshot(draft));
    expect(snapshot(chatted)).not.toBe(snapshot(draft));
    expect(snapshot({ document: NO_DOCUMENT, messages: [] })).not.toBe(snapshot(draft));
  });
});

describe("formatSavedAt", () => {
  it("reads SQLite timestamps as UTC", () => {
    const text = formatSavedAt("2026-11-17 14:05:00");
    expect(text).toContain("2026");
    expect(text).toContain("Nov");
  });

  it("returns unparseable values unchanged", () => {
    expect(formatSavedAt("soon")).toBe("soon");
  });
});
