/**
 * Canonical answer normaliser, shared across the answers, stats, and
 * leaderboard surfaces so they all group / compare on the same key.
 *
 * Behaviour identical to the previous in-route helper in
 * src/app/api/answers/route.ts. Extracted so:
 *   - `/api/snippets/[id]/stats` can group histograms by the same key
 *   - `/leaderboard` "Most common answers" can group on the same key
 *   - Alias matching (src/lib/answer-matching.ts) can compose with it
 *
 * Steps:
 *   1. NFKD normalise + strip combining diacritics ("é" → "e")
 *   2. Lowercase
 *   3. Replace `&` with " and "
 *   4. Drop everything except alphanumerics + spaces
 *   5. Drop articles (`a`, `an`, `the`)
 *   6. Collapse whitespace + trim
 */
export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(a|an|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lightweight, conservative singulariser. Used only for fuzzy matching
 * (alias-aware isCorrect), NOT for grouping in stats/leaderboard
 * (where users see what they actually typed).
 *
 * Strips a trailing 's' only when:
 *   - the word is >3 characters (keeps short tokens like "gas" intact),
 *   - it isn't a double-s like "wrasse" / "bass",
 *   - it isn't "us" (e.g. "Pollachius") so binomials survive.
 *
 * Deliberately simple: this is a pattern-match for plural forms in the
 * species catalogue, not an English-language singulariser.
 */
export function singulariseToken(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith("ss")) return token;
  if (token.endsWith("us")) return token;
  if (token.endsWith("s")) return token.slice(0, -1);
  return token;
}

/**
 * Normalises and singularises each token. Used by the answer-matching
 * helper so "catsharks" and "catshark" compare equal.
 */
export function normalizeForMatch(value: string): string {
  return normalizeAnswer(value)
    .split(" ")
    .map(singulariseToken)
    .filter(Boolean)
    .join(" ");
}
