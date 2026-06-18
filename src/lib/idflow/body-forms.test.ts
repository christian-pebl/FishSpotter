import { describe, it, expect } from "vitest";
import {
  SUB_SPLITS,
  bodyFormConfigFor,
  exampleSpeciesForForm,
} from "@/lib/idflow/body-forms";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { speciesValuesFor } from "@/lib/idguide/narrow";
import type { ShapeClass } from "@/lib/idguide/traits";

const SUBSPLIT_CLASSES = Object.keys(SUB_SPLITS) as ShapeClass[];

describe("body-forms (Rung 2 data)", () => {
  it("every sub-split class yields a discriminating config (>=2 options)", () => {
    for (const cls of SUBSPLIT_CLASSES) {
      const config = bodyFormConfigFor(cls);
      expect(config, `${cls} should have a Rung-2 config`).not.toBeNull();
      expect(config!.options.length, `${cls} options`).toBeGreaterThanOrEqual(2);
    }
  });

  it("every offered option is present in the catalogue (count > 0)", () => {
    for (const cls of SUBSPLIT_CLASSES) {
      const config = bodyFormConfigFor(cls)!;
      for (const o of config.options) {
        expect(o.count, `${cls}/${o.value} count`).toBeGreaterThan(0);
      }
    }
  });

  it("every offered option resolves to >=1 example species (so the Examples button is never empty)", () => {
    for (const cls of SUBSPLIT_CLASSES) {
      const config = bodyFormConfigFor(cls)!;
      for (const o of config.options) {
        const examples = exampleSpeciesForForm(cls, config.key, o.value);
        expect(examples.length, `${cls}/${o.value} examples`).toBeGreaterThanOrEqual(1);
        // example rows must carry both names for SpeciesGallery + the heading
        for (const e of examples) {
          expect(e.scientificName).toBeTruthy();
          expect(e.commonName).toBeTruthy();
        }
      }
    }
  });

  it("single-species class (flatfish) gets no Rung-2 gate", () => {
    for (const cls of ["flatfish"] as ShapeClass[]) {
      expect(bodyFormConfigFor(cls), `${cls} should be null`).toBeNull();
    }
  });

  // The beginner-legibility ceiling (17 Jun 2026 review): no decision node may
  // offer more than 10 options. Every Rung-2 bucket feeds a Rung-3 photo grid,
  // so each option's species count is what a user actually faces — keep it <=10.
  it("no Rung-2 bucket exceeds 10 species (the >10 = add-a-rung ceiling)", () => {
    for (const cls of SUBSPLIT_CLASSES) {
      const config = bodyFormConfigFor(cls)!;
      for (const o of config.options) {
        expect(
          o.count,
          `${cls}/${o.value} has ${o.count} species — split it further (ceiling is 10)`,
        ).toBeLessThanOrEqual(10);
      }
    }
  });

  it("the fish Rung-2 groups cover every fish exactly once-or-more (no orphan, no leak)", () => {
    const fish = Object.entries(CATALOGUE).filter(([, t]) => t.shapeClass === "fish");
    const config = bodyFormConfigFor("fish")!;
    const groupValues = new Set(config.options.map((o) => o.value));
    for (const [sci, t] of fish) {
      const vals = speciesValuesFor(t, config.key);
      expect(vals.length, `${t.commonName} (${sci}) has no ${config.key}`).toBeGreaterThanOrEqual(1);
      for (const v of vals) {
        expect(groupValues.has(v), `${t.commonName}: ${config.key}="${v}" is not an offered group`).toBe(
          true,
        );
      }
    }
  });
});
