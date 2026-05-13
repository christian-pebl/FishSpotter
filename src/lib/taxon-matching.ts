// Shared taxon-matching utilities: normalize input, exact alias lookup, fuzzy fallback.

import { prisma } from "@/lib/prisma";

/** Normalize a string for alias matching: lowercase, collapse whitespace, strip diacritics, drop leading articles. */
export function normalizeAlias(s: string): string {
  if (!s) return "";
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(a|an|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function similarityScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const distScore = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  // Token overlap
  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  let overlap = 0;
  for (const t of aTokens) if (bTokens.has(t)) overlap++;
  const overlapScore = aTokens.size === 0 || bTokens.size === 0 ? 0 : overlap / Math.max(aTokens.size, bTokens.size);
  // Containment bonus
  const shortest = Math.min(a.length, b.length);
  const containmentScore = shortest >= 4 && (a.includes(b) || b.includes(a)) ? 0.84 : 0;
  return Math.max(distScore, distScore * 0.75 + overlapScore * 0.25, containmentScore);
}

function suggestionThreshold(len: number): number {
  if (len <= 4) return 0.78;
  if (len <= 8) return 0.74;
  return 0.7;
}

export type TaxonResolution =
  | { kind: "exact"; taxonId: string; display: string }
  | { kind: "suggestion"; original: string; suggestion: string }
  | { kind: "unrecognised" };

/**
 * Resolve a user's free-text answer to a Taxon.
 * 1. Try exact alias lookup (after normalization).
 * 2. If no hit, fuzzy-match against all aliases; return suggestion if score ≥ threshold.
 * 3. Else return unrecognised.
 */
export async function resolveAnswerToTaxon(rawInput: string): Promise<TaxonResolution> {
  const normalized = normalizeAlias(rawInput);
  if (!normalized || normalized.length < 2) return { kind: "unrecognised" };

  // Exact match
  const exact = await prisma.taxonAlias.findUnique({ where: { alias: normalized } });
  if (exact) {
    return { kind: "exact", taxonId: exact.taxonId, display: exact.display };
  }

  // Fuzzy fallback over all aliases
  const all = await prisma.taxonAlias.findMany({
    select: { alias: true, display: true, taxonId: true },
  });
  let best: { score: number; alias: string; display: string } | null = null;
  for (const a of all) {
    const score = similarityScore(normalized, a.alias);
    if (!best || score > best.score) best = { score, alias: a.alias, display: a.display };
  }
  if (best && best.score >= suggestionThreshold(normalized.length)) {
    return { kind: "suggestion", original: rawInput.trim(), suggestion: best.display };
  }
  return { kind: "unrecognised" };
}
