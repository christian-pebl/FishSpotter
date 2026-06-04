/**
 * Client-side species search index for the "Skip to guess" typeahead.
 *
 * The set of valid answers is closed and small (the catalogue), so suggestions
 * are computed locally — instant, free, offline, and always grounded in real
 * species. No per-keystroke network call (the optional Gemini path is an
 * on-demand fallback, not this hot loop).
 *
 * Sources, merged into one entry per species:
 *   - CATALOGUE: scientificName + canonical commonName (the value submitted)
 *   - species-aliases.json: an editorial commonName + alias list (alternate
 *     common names, short forms, plurals, genus, common misspellings)
 *
 * All forms are normalised with normalizeForMatch (the same key the scoring
 * matcher uses), so "cod" / "codfish" / "Gadus" / "atlantic cod" all resolve to
 * one species, and the submitted canonical name scores an exact match.
 */

import { CATALOGUE } from "@/lib/idguide/catalogue";
import speciesAliasesRaw from "@/data/species-aliases.json";
import { normalizeForMatch } from "@/lib/normalize-answer";

type AliasFile = Record<string, { commonName: string; aliases: string[] }>;
const ALIASES = speciesAliasesRaw as AliasFile;

export interface SpeciesSuggestion {
  scientificName: string;
  /** Canonical common name — what gets submitted. */
  commonName: string;
  /** The acceptable form that actually matched the query (may be an alias). */
  matchedForm: string;
  /** True when the match came via an alias, not the canonical common name. */
  viaAlias: boolean;
  /** Relevance score (higher is better); for ranking + exact-match detection. */
  score: number;
}

interface Form {
  raw: string;
  norm: string;
  isCommon: boolean;
}
interface Entry {
  scientificName: string;
  commonName: string;
  forms: Form[];
}

function buildIndex(): Entry[] {
  const entries: Entry[] = [];
  for (const [scientificName, traits] of Object.entries(CATALOGUE)) {
    const commonName = traits.commonName;
    const formByNorm = new Map<string, Form>();
    const add = (raw: string, isCommon = false) => {
      const norm = normalizeForMatch(raw);
      if (!norm) return;
      // First writer wins, but a later canonical-name form upgrades isCommon.
      const existing = formByNorm.get(norm);
      if (existing) {
        if (isCommon) existing.isCommon = true;
        return;
      }
      formByNorm.set(norm, { raw, norm, isCommon });
    };
    add(commonName, true);
    add(scientificName);
    const alias = ALIASES[scientificName];
    if (alias) {
      add(alias.commonName, true);
      for (const a of alias.aliases) add(a);
    }
    entries.push({ scientificName, commonName, forms: [...formByNorm.values()] });
  }
  return entries;
}

const INDEX: Entry[] = buildIndex();

/** Bounded Levenshtein: returns the true distance, or `max + 1` once it's clear
 * the distance exceeds `max` (cheap early-out for the typo tier). */
function boundedEditDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/** Score one normalised query against one form. 0 = no match. */
function scoreForm(q: string, form: Form): number {
  const f = form.norm;
  if (f === q) return 100;
  if (f.startsWith(q)) return 85;
  if (f.split(" ").some((w) => w.startsWith(q))) return 70;
  if (f.includes(q)) return 55;
  // Typo tolerance only for reasonably long queries, so short fragments don't
  // fuzzy-match half the catalogue.
  if (q.length >= 4) {
    // Whole-string typo (e.g. "wrase" -> "wrasse").
    const d = boundedEditDistance(q, f, 2);
    if (d <= 2) return 45 - (d - 1) * 10;
    // Per-word typo for multi-word forms (e.g. "balan wrasse").
    for (const w of f.split(" ")) {
      if (w.length >= 4 && boundedEditDistance(q, w, 2) <= 2) return 30;
    }
  }
  return 0;
}

/**
 * Rank catalogue species by how well any of their accepted forms match the
 * query. One row per species (deduped), best-first. Returns [] for an empty or
 * whitespace query.
 */
export function searchSpecies(query: string, limit = 8): SpeciesSuggestion[] {
  const q = normalizeForMatch(query);
  if (!q) return [];

  const out: SpeciesSuggestion[] = [];
  for (const entry of INDEX) {
    let best = 0;
    let bestForm: Form | null = null;
    for (const form of entry.forms) {
      let s = scoreForm(q, form);
      if (s > 0 && form.isCommon) s += 2; // tie-break toward the canonical name
      if (s > best) {
        best = s;
        bestForm = form;
      }
    }
    if (best > 0 && bestForm) {
      const commonNorm = normalizeForMatch(entry.commonName);
      out.push({
        scientificName: entry.scientificName,
        commonName: entry.commonName,
        matchedForm: bestForm.raw,
        viaAlias: bestForm.norm !== commonNorm,
        score: best,
      });
    }
  }

  out.sort((a, b) => b.score - a.score || a.commonName.localeCompare(b.commonName));
  return out.slice(0, limit);
}
