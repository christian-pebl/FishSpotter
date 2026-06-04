import { z } from "zod";
import speciesTraitsData from "@/data/species-traits.json";
import {
  BODY_SHAPE,
  SIZE,
  COLORATION,
  MARKINGS,
  FIN_SHAPE,
  FEATURES,
  BEHAVIOR,
  HABITAT,
  MOVEMENT,
  SHAPE_CLASS,
  BODY_DEPTH,
  LATERAL_LINE,
  CARAPACE_TEXTURE,
  CRAB_FEATURES,
  CRAB_FORM,
  CEPHALOPOD_FORM,
  ARM_FORM,
  SHELL_SHAPE,
  BELL_FORM,
  type SpeciesCatalogue,
} from "./traits";

// Single source of truth for loading + validating the species catalogue.
//
// Before this module existed, every consumer imported the raw JSON and wrote
// `speciesTraitsData as unknown as SpeciesCatalogue` — an unchecked cast that
// erased all type information, so a typo'd shapeClass or a trait value placed
// under the wrong key (e.g. a HABITAT value under `behavior`) was invisible to
// `tsc` and silently dropped at runtime by narrow.ts's sanitiser.
//
// Now there is one schema, one validation point, and one typed export. The
// schema is built FROM the `as const` enum arrays in traits.ts, so the
// vocabulary can never drift between the type system and the validator.
//
// Enforcement has two tiers:
//   - HARD (CI): `species-traits.test.ts` runs `SpeciesCatalogueSchema.parse`
//     and fails the build on any invalid or unknown-keyed entry.
//   - SOFT (runtime): this module runs a non-throwing `safeParse` at load and
//     logs a loud error if the data is ever invalid in production, but still
//     returns the catalogue so a single bad row can't take down the app.

const speciesTraitsSchema = z
  .object({
    commonName: z.string().min(1),
    shapeClass: z.enum(SHAPE_CLASS),
    // Invertebrate entries (crab/squid/starfish/gastropod/jellyfish) carry an
    // empty bodyShape and discriminate on their class-specific "form" enum
    // (crabForm, cephalopodForm, ...) instead, so an empty array is valid here.
    bodyShape: z.array(z.enum(BODY_SHAPE)),
    size: z.enum(SIZE),
    coloration: z.array(z.enum(COLORATION)),
    markings: z.array(z.enum(MARKINGS)),
    finShape: z.array(z.enum(FIN_SHAPE)),
    features: z.array(z.enum(FEATURES)),
    behavior: z.array(z.enum(BEHAVIOR)),
    habitat: z.array(z.enum(HABITAT)),
    movement: z.array(z.enum(MOVEMENT)),
    // Optional Rung-3 / invert splitters — present only on entries that need
    // them, absent elsewhere (see SpeciesTraits in traits.ts).
    bodyDepth: z.array(z.enum(BODY_DEPTH)).optional(),
    lateralLine: z.array(z.enum(LATERAL_LINE)).optional(),
    carapaceTexture: z.array(z.enum(CARAPACE_TEXTURE)).optional(),
    crabFeatures: z.array(z.enum(CRAB_FEATURES)).optional(),
    crabForm: z.array(z.enum(CRAB_FORM)).optional(),
    cephalopodForm: z.array(z.enum(CEPHALOPOD_FORM)).optional(),
    armForm: z.array(z.enum(ARM_FORM)).optional(),
    shellShape: z.array(z.enum(SHELL_SHAPE)).optional(),
    bellForm: z.array(z.enum(BELL_FORM)).optional(),
    fieldNote: z.string().min(1),
  })
  .strict();

// Catalogue = a record keyed by scientific binomial.
export const SpeciesCatalogueSchema = z.record(z.string(), speciesTraitsSchema);

export type ValidatedSpeciesTraits = z.infer<typeof speciesTraitsSchema>;

function loadCatalogue(): SpeciesCatalogue {
  const result = SpeciesCatalogueSchema.safeParse(speciesTraitsData);
  if (!result.success) {
    // Loud, non-fatal: CI's strict test is the real gate; this is the
    // production tripwire so a bad deploy is at least visible in logs.
    console.error(
      "[catalogue] species-traits.json failed schema validation:",
      result.error.issues
        .slice(0, 10)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    );
  }
  return speciesTraitsData as unknown as SpeciesCatalogue;
}

/** The validated, typed species catalogue. Import this — never the raw JSON. */
export const CATALOGUE: SpeciesCatalogue = loadCatalogue();
