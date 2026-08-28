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
        const examples = exampleSpeciesForForm(cls, config.key, o.values);
        expect(examples.length, `${cls}/${o.value} examples`).toBeGreaterThanOrEqual(1);
        // example rows must carry both names for SpeciesGallery + the heading
        for (const e of examples) {
          expect(e.scientificName).toBeTruthy();
          expect(e.commonName).toBeTruthy();
        }
      }
    }
  });

  it("a bundled tile's identity value is one of the values it covers", () => {
    for (const cls of SUBSPLIT_CLASSES) {
      const config = bodyFormConfigFor(cls)!;
      for (const o of config.options) {
        expect(o.values.length, `${cls}/${o.value} values`).toBeGreaterThanOrEqual(1);
        expect(
          o.values.includes(o.value),
          `${cls}/${o.value} must be among its own values (it drives the silhouette + breadcrumb)`,
        ).toBe(true);
      }
    }
  });

  it("single-species class (flatfish) gets no Rung-2 gate", () => {
    for (const cls of ["flatfish"] as ShapeClass[]) {
      expect(bodyFormConfigFor(cls), `${cls} should be null`).toBeNull();
    }
  });

  // The beginner-legibility ceiling (17 Jun 2026 review), amended 28 Aug 2026.
  //
  // The original rule was "no Rung-2 bucket may hold more than 10 species",
  // because at the time every bucket was a NAMED family the user had to
  // recognise, and a long list of those is unreadable. Fish were re-cut on 28
  // Aug to a two-tile zone question (seabed vs water column), which trades
  // bucket size for a gate the user can answer from the clip alone. The buckets
  // are now 16-17, and that is the point of the change, not a regression.
  //
  // So the ceiling is now enforced where it still means something: the number
  // of OPTIONS at the node (a real reading cost, capped at 10 everywhere), and
  // the size of the Rung-3 photo grid it feeds (capped at the CandidateGate's
  // own 24-tile limit, beyond which species become unreachable).
  const RUNG3_TILE_CAP = 24;

  it("no Rung-2 node offers more than 10 options", () => {
    for (const cls of SUBSPLIT_CLASSES) {
      const config = bodyFormConfigFor(cls)!;
      expect(config.options.length, `${cls} offers ${config.options.length} options`)
        .toBeLessThanOrEqual(10);
    }
  });

  it("no Rung-2 bucket exceeds the Rung-3 photo-grid cap (species would be unreachable)", () => {
    for (const cls of SUBSPLIT_CLASSES) {
      const config = bodyFormConfigFor(cls)!;
      for (const o of config.options) {
        expect(
          o.count,
          `${cls}/${o.value} has ${o.count} species, over the ${RUNG3_TILE_CAP}-tile Rung-3 cap`,
        ).toBeLessThanOrEqual(RUNG3_TILE_CAP);
      }
    }
  });

  // Invert classes still cut on a named form, so the original 10 ceiling holds
  // for them. Fish are the deliberate exception.
  it("every non-fish Rung-2 bucket still respects the 10-species ceiling", () => {
    for (const cls of SUBSPLIT_CLASSES) {
      if (cls === "fish") continue;
      const config = bodyFormConfigFor(cls)!;
      for (const o of config.options) {
        expect(o.count, `${cls}/${o.value} has ${o.count} species`).toBeLessThanOrEqual(10);
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
