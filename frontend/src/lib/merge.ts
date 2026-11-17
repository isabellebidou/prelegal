type Plain = Record<string, unknown>;

const isPlain = (value: unknown): value is Plain =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Applies the AI's answer on top of the current values. Only the fields the AI
 * changed from what was sent to it are taken (nested objects field by field),
 * so edits made in the form while the AI was replying are kept.
 */
export function mergeAiChanges<T extends object>(current: T, sent: T, returned: T): T {
  const result: Plain = { ...(current as Plain) };
  const [c, s, r] = [current, sent, returned] as Plain[];
  for (const key of Object.keys(r)) {
    if (isPlain(c[key]) && isPlain(s[key]) && isPlain(r[key])) {
      result[key] = mergeAiChanges(c[key], s[key], r[key]);
    } else if (r[key] !== s[key]) {
      result[key] = r[key];
    }
  }
  return result as T;
}
