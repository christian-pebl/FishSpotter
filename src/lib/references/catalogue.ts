/**
 * Validated loader for the species reference catalogue.
 *
 * The single typed entry point for provenance, mirroring how
 * `@/lib/idguide/catalogue` is the single entry point for traits: the JSON is
 * parsed and zod-validated once at module load, so a malformed source entry or
 * a dangling source id fails fast (and fails CI via the co-located test)
 * instead of rendering a broken citation to a user.
 *
 * Consumers import `REFERENCES` from here, never the raw JSON.
 */

import referencesData from "@/data/species-references.json";
import verificationData from "@/data/reference-verification.json";
import { referenceFileSchema, type Claim, type Source, type SpeciesReference } from "./schema";

export const REFERENCES = referenceFileSchema.parse(referencesData);

/** Machine-verification results, written by `npm run refs:verify`. */
export type VerificationRecord = {
  status: "ok" | "unreachable" | "mismatch" | "blocked" | "unchecked-local";
  httpStatus: number;
  /** Which expected string was found in the fetched document. */
  matchedOn?: string;
  checkedOn: string;
  note?: string;
};
export const VERIFICATION = verificationData as Record<string, VerificationRecord>;

/** A source paired with what verification currently knows about it. */
export type ResolvedSource = Source & {
  id: string;
  verification?: VerificationRecord;
  /** True only when the link resolves AND the document names the species. */
  linkVerified: boolean;
};

export function getSource(id: string): ResolvedSource | null {
  const src = REFERENCES.sources[id];
  if (!src) return null;
  const verification = VERIFICATION[id];
  return { ...src, id, verification, linkVerified: verification?.status === "ok" };
}

export function referencesFor(scientificName: string): SpeciesReference | null {
  return REFERENCES.species[scientificName] ?? null;
}

/** Every source cited for a species, in citation order, skipping dangling ids. */
export function sourcesFor(scientificName: string): ResolvedSource[] {
  const entry = referencesFor(scientificName);
  if (!entry) return [];
  return entry.sourceIds.map(getSource).filter((s): s is ResolvedSource => s !== null);
}

/**
 * Claim keys are addressable so binding can be exhaustive rather than vague.
 * Build them with these helpers, never by hand at a call site.
 */
export const claimKey = {
  fieldNote: () => "fieldNote",
  mark: (markId: string) => `mark:${markId}`,
  trait: (trait: string) => `trait:${trait}`,
  dietEats: () => "diet:eats",
  dietEatenBy: () => "diet:eatenBy",
  trophicTier: () => "trophic:tier",
  farmRole: () => "farm:role",
  edge: (prey: string, predator: string) => `edge:${prey}->${predator}`,
} as const;

export function claimFor(scientificName: string, key: string): Claim | null {
  return referencesFor(scientificName)?.claims[key] ?? null;
}

/** The sources backing one claim, ready to render as numbered markers. */
export function sourcesForClaim(scientificName: string, key: string): ResolvedSource[] {
  const claim = claimFor(scientificName, key);
  if (!claim) return [];
  return claim.sourceIds.map(getSource).filter((s): s is ResolvedSource => s !== null);
}

/**
 * Human-readable citation line. Deliberately plain and consistent rather than
 * a specific academic house style, since it is read on a phone by a member of
 * the public, not by a journal copy editor.
 */
export function formatCitation(source: ResolvedSource): string {
  const bits: string[] = [];
  if (source.authors?.length) bits.push(source.authors.join(", "));
  if (source.year) bits.push(`(${source.year})`);
  bits.push(source.title);
  bits.push(source.publisher);
  if (source.identifier) bits.push(source.identifier);
  const accessed = source.verification?.checkedOn;
  if (accessed && source.url) bits.push(`accessed ${accessed}`);
  return bits.join(". ") + ".";
}
