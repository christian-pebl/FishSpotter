/**
 * Reference / provenance schema for the species guide.
 *
 * Every user-facing claim on a species guide (the field note, each diagnostic
 * mark, each trait row, the diet statements, the trophic tier and the farm
 * role) is addressable by a claim key and bound to one or more sources here.
 *
 * Two trust levels are deliberately kept apart:
 *
 *   linkVerified   - machine. The URL resolves, and the fetched document
 *                    actually mentions the species. Proves the citation points
 *                    somewhere real; proves nothing about the claim.
 *   claimSupported - only true when the supporting passage has been READ and a
 *                    short attributed locator/quote recorded against it. No
 *                    script that cannot read the source may set this.
 *
 * The split exists because a gate that only checks its own output is worse than
 * no gate: it manufactures confidence. See the FUSE annex-4 lesson.
 */

import { z } from "zod";

/** Where a source lives, which decides how it is verified and cited. */
export const SOURCE_KINDS = [
  "worms", // World Register of Marine Species (taxonomy only)
  "marlin", // MarLIN species page / PDF snapshot (UK-specific, the spine)
  "fishbase", // FishBase summary (fish depth, trophic level, diet)
  "sealifebase", // SeaLifeBase summary (invertebrate equivalent)
  "fao", // FAO Species Catalogue volumes (open access)
  "bto", // BTO BirdFacts (the two birds MarLIN does not carry)
  "scos", // SCOS annual report (SMRU, the authoritative UK seal source)
  "obis", // OBIS occurrence records (the depth + distribution panels)
  "plymsea", // Plymouth Marine Science Electronic Archive (Russell's Medusae)
  "bhl", // Biodiversity Heritage Library / archive.org public-domain scans
  "guide-pdf", // an ID guide PDF held in decision-tree/id-guides
  "book", // a print book, cited by page, not quoted into the UI
  "journal", // a peer-reviewed paper
  "pebl-observation", // PEBL's own footage: a primary source we own
  "web", // anything else, used sparingly and always with a named publisher
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/**
 * A citable source, held once in a global registry and referenced by id, so a
 * multi-species work (an FAO volume, Hayward & Ryland) is described once.
 */
export const sourceSchema = z.object({
  kind: z.enum(SOURCE_KINDS),
  /** Full title of the work or page. */
  title: z.string().min(1),
  /** Author or editor surnames, as cited. Omit for institutional pages. */
  authors: z.array(z.string()).optional(),
  /** Publishing body, e.g. "Marine Biological Association of the UK". */
  publisher: z.string().min(1),
  /** Publication or last-update year, when the source states one. */
  year: z.number().int().min(1700).max(2100).optional(),
  /** Canonical public URL. Absent only for a local-only book/PDF. */
  url: z.string().url().optional(),
  /** Repo-relative path when we hold a copy (in-repo ID guides). */
  localPath: z.string().optional(),
  /** Licence of the source document, when it states one. */
  licence: z.string().optional(),
  /** Stable identifier where one exists (DOI, ISBN, AphiaID). */
  identifier: z.string().optional(),
  /**
   * How verification should confirm this URL landed on the right thing: the
   * strings that must appear in the fetched document. Usually the binomial.
   */
  expectText: z.array(z.string()).optional(),
  /**
   * Vernacular name to accept in the document title, for publishers whose
   * titles are common-name only (BTO renders "Shag | BTO"). When set,
   * verification accepts a title naming this PLUS the binomial in the body.
   */
  expectCommonName: z.string().optional(),
  /**
   * How this source can be machine-checked.
   *
   *   "html-title" (default) the page must say in its own title that it is
   *                          about the species.
   *   "pdf"                  the document is a PDF, so there is no title to
   *                          test over HTTP. Verification proves only that it
   *                          is still retrievable and still a PDF; that it is
   *                          about the species is evidenced by a recorded page
   *                          locator read from the document itself, which the
   *                          catalogue test requires every PDF source to have.
   */
  verifyMode: z.enum(["html-title", "pdf"]).optional(),
});
export type Source = z.infer<typeof sourceSchema>;

/** A single piece of evidence read out of a source in support of one claim. */
export const supportSchema = z.object({
  sourceId: z.string().min(1),
  /** Where in the source, e.g. "Biology > Feeding", "p. 412", "Table 3". */
  locator: z.string().min(1),
  /**
   * Short attributed extract that carries the claim. Kept brief on purpose:
   * enough for a reviewer to check the claim without re-reading the source,
   * short enough to stay well inside fair dealing. Omit entirely for sources
   * we hold only as an unauthorised copy.
   */
  quote: z.string().max(240).optional(),
  /** Who read the passage. Free text: an email, or "gemini-extract". */
  readBy: z.string().min(1),
  /** ISO date the passage was read. */
  readOn: z.string().min(4),
});
export type Support = z.infer<typeof supportSchema>;

export const claimSchema = z.object({
  /** Sources offered for this claim, most directly supporting first. */
  sourceIds: z.array(z.string().min(1)).min(1),
  /** Passages actually read. Empty means the binding is asserted, not evidenced. */
  support: z.array(supportSchema).default([]),
  /**
   * True only when `support` carries a passage that genuinely carries the claim
   * and a human or a documented extraction confirmed it. Never set by a
   * resolver.
   */
  claimSupported: z.boolean().default(false),
  /** Set when the source disagrees with what the app currently says. */
  conflict: z.string().optional(),
});
export type Claim = z.infer<typeof claimSchema>;

/** Taxonomic identity, resolved from WoRMS. The anchor every citation hangs off. */
export const identitySchema = z.object({
  aphiaId: z.number().int().positive(),
  acceptedName: z.string().min(1),
  authority: z.string().optional(),
  rank: z.string().min(1),
  phylum: z.string().optional(),
  class: z.string().optional(),
  order: z.string().optional(),
  family: z.string().optional(),
  url: z.string().url(),
  resolvedOn: z.string().min(4),
  /**
   * Set when the catalogue key is not the name we resolved, e.g. the
   * group-level "Majoidea" entry resolved through its representative species.
   */
  resolvedVia: z.string().optional(),
});
export type Identity = z.infer<typeof identitySchema>;

export const speciesReferenceSchema = z.object({
  identity: identitySchema.optional(),
  /** Every source consulted for this species, in citation order. */
  sourceIds: z.array(z.string().min(1)).default([]),
  /**
   * Claim key -> binding. Keys are:
   *   fieldNote, mark:<diagnosticMarkId>, trait:size, trait:habitat,
   *   trait:behavior, diet:eats, diet:eatenBy, trophic:tier, farm:role,
   *   edge:<prey>-><predator>
   */
  claims: z.record(z.string(), claimSchema).default({}),
});
export type SpeciesReference = z.infer<typeof speciesReferenceSchema>;

export const referenceFileSchema = z.object({
  version: z.literal(1),
  /** Global source registry, id -> source. */
  sources: z.record(z.string(), sourceSchema),
  /** Catalogue scientific name -> its references. */
  species: z.record(z.string(), speciesReferenceSchema),
});
export type ReferenceFile = z.infer<typeof referenceFileSchema>;
