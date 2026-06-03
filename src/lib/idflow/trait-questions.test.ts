import { describe, expect, it } from "vitest";
import { traitQuestion } from "./trait-questions";
import {
  ARM_FORM,
  BEHAVIOR,
  BELL_FORM,
  BODY_SHAPE,
  CARAPACE_TEXTURE,
  CEPHALOPOD_FORM,
  COLORATION,
  CRAB_FEATURES,
  CRAB_FORM,
  FEATURES,
  FIN_SHAPE,
  HABITAT,
  MARKINGS,
  MOVEMENT,
  SHELL_SHAPE,
  SIZE,
} from "@/lib/idguide/traits";
import type { TraitKey } from "@/lib/idguide/narrow";

// Every value the info-gain picker could surface, keyed exactly as
// traitQuestion expects. If a new trait value lands without curated copy, the
// coverage test below fails instead of shipping `Does it look "none"?` to users.
const ALL_VALUES: Record<TraitKey, readonly string[]> = {
  bodyShape: BODY_SHAPE,
  size: SIZE,
  coloration: COLORATION,
  markings: MARKINGS,
  finShape: FIN_SHAPE,
  features: FEATURES,
  behavior: BEHAVIOR,
  habitat: HABITAT,
  movement: MOVEMENT,
  carapaceTexture: CARAPACE_TEXTURE,
  crabFeatures: CRAB_FEATURES,
  crabForm: CRAB_FORM,
  cephalopodForm: CEPHALOPOD_FORM,
  armForm: ARM_FORM,
  shellShape: SHELL_SHAPE,
  bellForm: BELL_FORM,
};

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

  it("has curated copy for EVERY catalogue trait value (no fallback in production)", () => {
    const uncovered: string[] = [];
    for (const key of Object.keys(ALL_VALUES) as TraitKey[]) {
      for (const value of ALL_VALUES[key]) {
        const q = traitQuestion(key, value);
        // The fallback is `Does it look <de-kebabed>?` — a curated entry never
        // matches that shape AND always ends in "?". Treat a fallback hit as a gap.
        if (q === `Does it look ${value.replace(/-/g, " ")}?`) uncovered.push(`${key}=${value}`);
      }
    }
    expect(uncovered).toEqual([]);
  });

  it("covers the 'none' values that fire in production (features + crabFeatures)", () => {
    expect(traitQuestion("features", "none")).toMatch(/plain-headed/i);
    expect(traitQuestion("crabFeatures", "none")).toMatch(/plain crab/i);
  });

  it("falls back to a quote-free de-kebabed prompt for a genuinely unknown value", () => {
    expect(traitQuestion("coloration", "some-future-value")).toBe(
      "Does it look some future value?",
    );
  });
});
