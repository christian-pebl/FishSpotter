import { describe, it, expect } from "vitest";
import {
  SUB_SPLITS,
  bodyFormConfigFor,
  exampleSpeciesForForm,
} from "@/lib/idflow/body-forms";
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

  it("single-species classes (flatfish, scooter) get no Rung-2 gate", () => {
    for (const cls of ["flatfish", "scooter"] as ShapeClass[]) {
      expect(bodyFormConfigFor(cls), `${cls} should be null`).toBeNull();
    }
  });
});
