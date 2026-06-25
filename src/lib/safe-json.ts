/**
 * Parse a JSON string that may be null/garbage without ever throwing.
 *
 * Used on the hot render paths (the feed) where a single malformed row must not
 * crash the whole server render and take the entire page down to the error
 * boundary. Returns null on null/empty input or any parse failure; callers treat
 * null as "no data" and degrade gracefully.
 */
export function safeParseJson(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
