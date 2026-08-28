import { describe, expect, it } from "vitest";
import { namesPrey } from "../extract-diet";

/**
 * These lock in the two bugs that put 18 wrong citations on feeding links,
 * found by an adversarial audit on 28 Aug 2026. Both were substring matches
 * that looked correct until someone opened the source page.
 */
describe("namesPrey", () => {
  it("does not match a genus inside a LONGER genus (the Liocarcinus bug)", () => {
    // "carcinus" is an alias for the shore crab, Carcinus maenas. It is also a
    // substring of Liocarcinus, a swimming crab in a different family. Four
    // feeding links were bound on that collision.
    const blob = "nekton crabs Liocarcinus holsatus UK Engld Wal juv./adults";
    expect(namesPrey(blob, "carcinus")).toBe(false);
    expect(namesPrey(blob, "liocarcinus")).toBe(true);
  });

  it("matches the real prey when the record genuinely names it", () => {
    const blob = "nekton crabs Carcinus maenas Ireland juv./adults";
    expect(namesPrey(blob, "carcinus")).toBe(true);
    expect(namesPrey(blob, "carcinus maenas")).toBe(true);
  });

  it("does not match a FishBase CATEGORY label (the cuttlefish bug)", () => {
    // "squids/cuttlefish" is the Food III column heading. The conger eel's
    // actual cephalopod rows are Eledone cirrhosa, an octopus.
    const blob = "nekton cephalopods squids/cuttlefish Eledone cirrhosa Portugal adults";
    expect(namesPrey(blob, "cuttlefish")).toBe(false);
    expect(namesPrey(blob, "eledone")).toBe(true);
  });

  it("still matches a cuttlefish when one is actually recorded as prey", () => {
    const blob = "nekton cephalopods squids/cuttlefish Sepia officinalis France adults";
    expect(namesPrey(blob, "sepia officinalis")).toBe(true);
    expect(namesPrey(blob, "sepia")).toBe(true);
  });

  it("is case-insensitive and tolerant of punctuation around the term", () => {
    expect(namesPrey("prey: Gadidae, unidentified", "gadidae")).toBe(true);
    expect(namesPrey("(Ammodytidae)", "ammodytidae")).toBe(true);
  });

  it("does not match a term embedded in another word", () => {
    expect(namesPrey("Trisopterus esmarkii", "trisopterus esmarkii")).toBe(true);
    expect(namesPrey("Sandeel", "eel")).toBe(false);
  });
});
