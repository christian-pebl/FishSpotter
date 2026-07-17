import { describe, it, expect } from "vitest";
import seaweedFarmsData from "@/data/seaweed-farms.json";
import { FarmCatalogueSchema } from "./catalogue";

// The hard gate. Any invalid enum value, missing required field, or unknown key
// in seaweed-farms.json fails CI here, long before it can silently corrupt a
// farm profile page or a feed-card link at runtime.
describe("seaweed-farms.json schema", () => {
  it("every farm entry conforms to the catalogue schema (strict)", () => {
    const result = FarmCatalogueSchema.safeParse(seaweedFarmsData);
    if (!result.success) {
      const summary = result.error.issues
        .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("\n");
      throw new Error(
        `seaweed-farms.json has ${result.error.issues.length} schema violation(s):\n${summary}`,
      );
    }
    expect(result.success).toBe(true);
  });
});

describe("seaweed farm catalogue consistency", () => {
  const farms = seaweedFarmsData as Record<
    string,
    { slug: string; deploymentNames: string[] }
  >;

  it("every record key matches its own slug field", () => {
    const mismatches = Object.entries(farms)
      .filter(([key, farm]) => key !== farm.slug)
      .map(([key, farm]) => `${key} !== ${farm.slug}`);
    expect(mismatches, mismatches.join("; ")).toEqual([]);
  });

  it("no Snippet.deployment value is claimed by more than one farm", () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const [slug, farm] of Object.entries(farms)) {
      for (const deployment of farm.deploymentNames) {
        const owner = seen.get(deployment);
        if (owner) duplicates.push(`"${deployment}" claimed by both ${owner} and ${slug}`);
        else seen.set(deployment, slug);
      }
    }
    expect(duplicates, duplicates.join("; ")).toEqual([]);
  });
});
