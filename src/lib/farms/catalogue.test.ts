import { existsSync } from "node:fs";
import { join } from "node:path";
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

  // Every image the catalogue references must actually exist under public/, so a
  // typo'd or missing asset fails CI instead of rendering a broken image live.
  it("every referenced media file exists in public/", () => {
    const mediaFarms = seaweedFarmsData as Record<
      string,
      { media?: { hero?: { src: string }; gallery?: { src: string }[] } }
    >;
    const publicDir = join(process.cwd(), "public");
    const missing: string[] = [];
    for (const [slug, farm] of Object.entries(mediaFarms)) {
      const srcs = [
        ...(farm.media?.hero ? [farm.media.hero.src] : []),
        ...(farm.media?.gallery?.map((g) => g.src) ?? []),
      ];
      for (const src of srcs) {
        if (!existsSync(join(publicDir, src))) missing.push(`${slug}: ${src}`);
      }
    }
    expect(missing, `missing media files:\n${missing.join("\n")}`).toEqual([]);
  });
});
