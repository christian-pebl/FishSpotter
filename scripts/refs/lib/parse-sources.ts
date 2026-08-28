/**
 * Deterministic section parsers for the two open-access sources that carry
 * most of the app's claims. No language model is involved: both sites publish
 * structured, stable sections, so the passage that backs a claim can be located
 * and quoted by rule rather than by inference.
 *
 * MarLIN   headings (Description, Identifying features, Habitat, Depth range,
 *          Biology, Habitat preferences), several of which contain a flat
 *          "Parameter / Data" table (Typically feeds on, Sociability, ...).
 * FishBase one long summary page keyed by bold labels (Environment:,
 *          Short description, Biology, Size / Weight / Age).
 */

import { pageText } from "./http";

export type Section = { heading: string; body: string };

/** Split a MarLIN page into its headed sections. */
export function parseMarlinSections(html: string): Map<string, string> {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const out = new Map<string, string>();
  const re = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>([\s\S]*?)(?=<h[1-6][^>]*>|$)/gi;
  for (const m of stripped.matchAll(re)) {
    const heading = pageText(m[2]).toLowerCase();
    const body = pageText(m[3]);
    if (!heading || !body) continue;
    // Keep the first occurrence: MarLIN repeats some headings in the
    // sensitivity-assessment tables further down the page.
    if (!out.has(heading)) out.set(heading, body);
  }
  return out;
}

/**
 * MarLIN renders several sections as a flat "Parameter Data" run of
 * label/value pairs. Pull one value out by its label.
 *
 * The value runs from the end of the label to the start of the next known
 * label, so an empty field ("Typically feeds on" with nothing recorded)
 * correctly comes back empty rather than swallowing the next parameter.
 */
const MARLIN_PARAMS = [
  "Typical abundance",
  "Male size range",
  "Male size at maturity",
  "Female size range",
  "Female size at maturity",
  "Growth form",
  "Growth rate",
  "Body flexibility",
  "Mobility",
  "Characteristic feeding method",
  "Diet/food source",
  "Typically feeds on",
  "Sociability",
  "Environmental position",
  "Dependency",
  "Supports",
  "Is the species harmful?",
  "Physiographic preferences",
  "Biological zone preferences",
  "Substratum / habitat preferences",
  "Tidal strength preferences",
  "Wave exposure preferences",
  "Salinity preferences",
  "Depth range",
  "Water clarity preferences",
  "Migration Pattern",
  "Reproductive type",
  "Reproductive frequency",
  "Fecundity (number of eggs)",
  "Generation time",
  "Age at maturity",
  "Season",
  "Life span",
];

export function marlinParam(body: string, label: string): string | null {
  const idx = body.toLowerCase().indexOf(label.toLowerCase());
  if (idx < 0) return null;
  const after = body.slice(idx + label.length);
  // Find the nearest following known label, which bounds this value.
  let end = after.length;
  for (const other of MARLIN_PARAMS) {
    if (other.toLowerCase() === label.toLowerCase()) continue;
    const j = after.toLowerCase().indexOf(other.toLowerCase());
    if (j >= 0 && j < end) end = j;
  }
  const value = after.slice(0, end).trim().replace(/^[:\-\s]+/, "").trim();
  return value.length ? value : null;
}

/**
 * Pull a labelled block out of a FishBase summary page. FishBase has no
 * heading structure to speak of, so a block runs from its own label to
 * whichever of the other known labels comes next.
 */
const FISHBASE_LABELS = [
  "Environment: milieu / climate zone / depth range / distribution range",
  "Distribution",
  "Length at first maturity / Size / Weight / Age",
  "Size / Weight / Age",
  "Short description",
  "Biology",
  "Life cycle and mating behavior",
  "Main reference",
  "IUCN Red List Status",
  "Threat to humans",
  "Human uses",
  "More information",
  "Resilience",
];

export function fishbaseBlock(text: string, label: string): string | null {
  const idx = text.indexOf(label);
  if (idx < 0) return null;
  const from = idx + label.length;
  let end = text.length;
  for (const other of FISHBASE_LABELS) {
    if (other === label) continue;
    const j = text.indexOf(other, from);
    if (j >= 0 && j < end) end = j;
  }
  const value = text
    .slice(from, end)
    .trim()
    // FishBase peppers prose with "(Ref. 1371 )" citation stubs; keeping them
    // would make every quote unreadable, and the reference list is on the page.
    .replace(/\(Refs?\.\s*[\d,\s]+\)/gi, "")
    /**
     * Strip FishBase's in-page NAVIGATION, which sits inside the labelled block
     * and would otherwise be the first thing a reader sees in a quoted passage:
     * a cod citation opened with "Identification keys | Morphology |
     * Morphometrics Dorsal spines (total): 0..." instead of the sentence about
     * the chin barbel that actually carries the claim.
     */
    .replace(/^(?:[A-Za-z][A-Za-z .\/'-]*\|)+[A-Za-z .\/'-]*/, " ")
    .replace(/Glossary \(e\.g\.[^)]*\)/gi, " ")
    .replace(/More info \| Plus d'info\. \| Mais info/gi, " ")
    .replace(/Upload your references[^.]*?Collaborators/gi, " ")
    .replace(/\s+/g, " ")
    // Removing a stub mid-sentence strands a space before the punctuation
    // ("chin barbel ."), which would show up in every FishBase quote.
    .replace(/\s+([.,;:)])/g, "$1")
    .trim();
  return value.length ? value : null;
}

/** FishBase prints its authoritative source for the species as "Main reference". */
export function fishbaseMainReference(text: string): string | null {
  const block = fishbaseBlock(text, "Main reference");
  if (!block) return null;
  return block.replace(/^Upload your references[^.]*Collaborators\s*/i, "").trim() || null;
}


/**
 * FishBase's "Short description" opens with a run of meristic counts
 * ("Dorsal spines (total): 0; Dorsal soft rays (total): 65 - 79; ...") and only
 * then gives the plain-language diagnosis that actually identifies the animal.
 * Quoting the counts as the evidence for "a long chin barbel" is useless to a
 * reader, so the leading meristic run is dropped and the quote starts at the
 * prose.
 *
 * Kept conservative: it only strips clauses that look like "Label: numbers;",
 * and only from the START. If the whole block is meristics, the block is left
 * alone rather than emptied.
 */
export function startAtProse(s: string): string {
  const MERISTIC = /^\s*[A-Za-z][A-Za-z \/()'.-]*:\s*[\d\s\-.,]+;?\s*/;
  let out = s;
  let guard = 0;
  while (MERISTIC.test(out) && guard++ < 12) {
    const next = out.replace(MERISTIC, "");
    if (!next.trim() || next === out) break;
    out = next;
  }
  return out.trim().length > 30 ? out.trim() : s.trim();
}

/** Trim a passage to a quotable length without cutting mid-word. */
export function quotable(s: string, max = 235): string {
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim() + "...";
}
