import { describe, it, expect } from "vitest";
import speciesTraitsData from "@/data/species-traits.json";
import speciesAliasesData from "@/data/species-aliases.json";
import speciesImagesData from "@/data/species-images.json";
import { SpeciesCatalogueSchema } from "./catalogue";

// The hard gate. Any invalid enum value, missing required field, or unknown key
// in species-traits.json fails CI here — long before it can silently corrupt
// the ID flow at runtime.
describe("species-traits.json schema", () => {
  it("every species entry conforms to the catalogue schema (strict)", () => {
    const result = SpeciesCatalogueSchema.safeParse(speciesTraitsData);
    if (!result.success) {
      const summary = result.error.issues
        .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("\n");
      throw new Error(
        `species-traits.json has ${result.error.issues.length} schema violation(s):\n${summary}`,
      );
    }
    expect(result.success).toBe(true);
  });
});

// Cross-file consistency: the catalogue is the source of truth, and the two
// sibling editorial files (aliases + curated photo overrides) must keep up with
// it. Without this, a new species scores 0 on common synonyms (missing alias)
// or has no teaching photo (missing override), with no error anywhere.
describe("species catalogue cross-file consistency", () => {
  const speciesKeys = Object.keys(speciesTraitsData);
  const aliases = speciesAliasesData as Record<
    string,
    { commonName: string; aliases: string[] }
  >;
  const overrides = (speciesImagesData as { overrides: Record<string, unknown> })
    .overrides;

  it("every species has an alias entry", () => {
    const missing = speciesKeys.filter((k) => !aliases[k]);
    expect(missing, `species missing from species-aliases.json: ${missing.join(", ")}`).toEqual(
      [],
    );
  });

  it("every species has a curated photo override", () => {
    const missing = speciesKeys.filter(
      (k) => !overrides[k] || (k.startsWith("_") ? true : false),
    );
    expect(
      missing,
      `species missing a curated override in species-images.json: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("alias commonName matches the catalogue commonName", () => {
    const mismatches: string[] = [];
    for (const k of speciesKeys) {
      const a = aliases[k];
      if (!a) continue;
      const cat = (speciesTraitsData as Record<string, { commonName: string }>)[k];
      if (a.commonName.toLowerCase() !== cat.commonName.toLowerCase()) {
        mismatches.push(`${k}: aliases="${a.commonName}" vs catalogue="${cat.commonName}"`);
      }
    }
    expect(mismatches, mismatches.join("; ")).toEqual([]);
  });
});
