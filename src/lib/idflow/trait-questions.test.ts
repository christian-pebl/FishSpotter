import { describe, expect, it } from "vitest";
import { traitQuestion } from "./trait-questions";

describe("traitQuestion", () => {
  it("returns curated copy for a known crab (key, value)", () => {
    expect(traitQuestion("crabFeatures", "swimming-paddle")).toMatch(/swimming paddle/i);
    expect(traitQuestion("carapaceTexture", "pie-crust")).toMatch(/pie-crust/i);
    expect(traitQuestion("size", "medium")).toMatch(/medium/i);
  });

  it("phrases every question as a yes/no prompt (ends with ?)", () => {
    expect(traitQuestion("crabFeatures", "red-eyes").endsWith("?")).toBe(true);
    expect(traitQuestion("habitat", "kelp").endsWith("?")).toBe(true);
  });

  it("falls back to a de-kebabed prompt for an uncurated value", () => {
    // A value with no curated entry still produces an answerable question.
    expect(traitQuestion("coloration", "some-future-value")).toBe(
      'Does it look "some future value"?',
    );
  });
});
