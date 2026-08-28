import { describe, expect, it } from "vitest";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { REFERENCES, VERIFICATION, getSource, sourcesFor } from "./catalogue";
import { referenceFileSchema } from "./schema";
import referencesData from "@/data/species-references.json";

/**
 * Structural gate for the reference catalogue. This checks the SHAPE of the
 * provenance data (no dangling ids, no unciteable source, no reference to a
 * species that does not exist), which is exactly what a build can prove.
 *
 * It deliberately does NOT assert that any link works or that any source
 * supports its claim. Link liveness is `npm run refs:verify` against the real
 * web; claim support needs a passage to be read. Asserting either here would
 * make the suite pass by checking the data against itself.
 */
describe("species reference catalogue", () => {
  it("parses strictly against the schema", () => {
    expect(() => referenceFileSchema.parse(referencesData)).not.toThrow();
  });

  it("only references species that exist in the trait catalogue", () => {
    const unknown = Object.keys(REFERENCES.species).filter((n) => !(n in CATALOGUE));
    expect(unknown).toEqual([]);
  });

  it("has no dangling source ids on a species", () => {
    const dangling: string[] = [];
    for (const [name, entry] of Object.entries(REFERENCES.species)) {
      for (const id of entry.sourceIds) {
        if (!REFERENCES.sources[id]) dangling.push(`${name} -> ${id}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it("has no dangling source ids on a claim, and every claim cites a source the species lists", () => {
    const problems: string[] = [];
    for (const [name, entry] of Object.entries(REFERENCES.species)) {
      const listed = new Set(entry.sourceIds);
      for (const [key, claim] of Object.entries(entry.claims)) {
        for (const id of claim.sourceIds) {
          if (!REFERENCES.sources[id]) problems.push(`${name} ${key} -> unknown source ${id}`);
          else if (!listed.has(id)) problems.push(`${name} ${key} -> ${id} not in the species source list`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("gives every source something a reader can actually follow", () => {
    const unciteable = Object.entries(REFERENCES.sources)
      .filter(([, s]) => !s.url && !s.localPath)
      .map(([id]) => id);
    expect(unciteable).toEqual([]);
  });

  it("gives every web source the strings needed to prove it is about the species", () => {
    const unprovable = Object.entries(REFERENCES.sources)
      .filter(([, s]) => s.url && (!s.expectText || s.expectText.length === 0))
      .map(([id]) => id);
    expect(unprovable).toEqual([]);
  });

  it("never marks a claim supported without a recorded passage", () => {
    const hollow: string[] = [];
    for (const [name, entry] of Object.entries(REFERENCES.species)) {
      for (const [key, claim] of Object.entries(entry.claims)) {
        if (claim.claimSupported && claim.support.length === 0) hollow.push(`${name} ${key}`);
      }
    }
    expect(hollow).toEqual([]);
  });

  it("requires every PDF source to carry a page locator someone actually read", () => {
    // A PDF has no title for verification to test, so `linkVerified` only
    // proves it is retrievable. The species match rests entirely on a recorded
    // passage, so a PDF source cited with no locator would be an unbacked
    // citation wearing a verified badge.
    const pdfIds = Object.entries(REFERENCES.sources)
      .filter(([, s]) => s.verifyMode === "pdf")
      .map(([id]) => id);
    const withLocator = new Set<string>();
    for (const entry of Object.values(REFERENCES.species)) {
      for (const claim of Object.values(entry.claims)) {
        for (const s of claim.support) if (s.locator.trim()) withLocator.add(s.sourceId);
      }
    }
    expect(pdfIds.filter((id) => !withLocator.has(id))).toEqual([]);
  });

  it("records verification only for sources that exist", () => {
    const orphaned = Object.keys(VERIFICATION).filter((id) => !REFERENCES.sources[id]);
    expect(orphaned).toEqual([]);
  });

  it("exposes only verified sources through sourcesFor consumers", () => {
    for (const name of Object.keys(REFERENCES.species)) {
      for (const s of sourcesFor(name)) {
        // linkVerified must never be true without a matching ok verification row.
        if (s.linkVerified) expect(VERIFICATION[s.id]?.status).toBe("ok");
      }
    }
  });

  it("resolves a known source id and returns null for an unknown one", () => {
    const anyId = Object.keys(REFERENCES.sources)[0];
    if (anyId) expect(getSource(anyId)?.id).toBe(anyId);
    expect(getSource("definitely:not-a-source")).toBeNull();
  });
});
