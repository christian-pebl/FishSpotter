import { describe, it, expect } from "vitest";
import { QUESTIONS, visibleQuestions } from "@/lib/id-guide-questions";

describe("id-guide-questions", () => {
  it("exposes the expected ordered question keys", () => {
    expect(QUESTIONS.map((q) => q.key)).toEqual([
      "functionalGroup",
      "locomotion",
      "screenZone",
      "bodyShape",
      "colorTag",
    ]);
  });

  it("Q1 always has an 'unsure' fallback option", () => {
    const q1 = QUESTIONS[0];
    expect(q1.options.some((o) => o.value === "unsure")).toBe(true);
  });

  it("Q4 (bodyShape) is hidden when functionalGroup is gastropod / echinoderm / cephalopod / unsure", () => {
    expect(visibleQuestions({ functionalGroup: "gastropod" }).map((q) => q.key)).not.toContain("bodyShape");
    expect(visibleQuestions({ functionalGroup: "echinoderm" }).map((q) => q.key)).not.toContain("bodyShape");
    expect(visibleQuestions({ functionalGroup: "cephalopod" }).map((q) => q.key)).not.toContain("bodyShape");
    expect(visibleQuestions({}).map((q) => q.key)).not.toContain("bodyShape");
  });

  it("Q4 (bodyShape) is shown for fish / crab / jellyfish", () => {
    expect(visibleQuestions({ functionalGroup: "fish" }).map((q) => q.key)).toContain("bodyShape");
    expect(visibleQuestions({ functionalGroup: "crab" }).map((q) => q.key)).toContain("bodyShape");
    expect(visibleQuestions({ functionalGroup: "jellyfish" }).map((q) => q.key)).toContain("bodyShape");
  });

  it("Q4 options change based on functionalGroup", () => {
    const q4 = QUESTIONS.find((q) => q.key === "bodyShape")!;
    const fishOpts = q4.optionsFor!({ functionalGroup: "fish" });
    const crabOpts = q4.optionsFor!({ functionalGroup: "crab" });
    const jellyOpts = q4.optionsFor!({ functionalGroup: "jellyfish" });

    expect(fishOpts.map((o) => o.value)).toContain("streamlined");
    expect(fishOpts.map((o) => o.value)).toContain("flat");
    expect(crabOpts.map((o) => o.value)).toContain("hidden-in-shell");
    expect(crabOpts.map((o) => o.value)).toContain("squarish");
    expect(jellyOpts.map((o) => o.value)).toContain("bell-shape");

    // No overlap between fish-shapes and crab-shapes
    const fishVals = new Set(fishOpts.map((o) => o.value));
    expect(crabOpts.some((o) => fishVals.has(o.value))).toBe(false);
  });

  it("optional questions are flagged so the UI knows skip is allowed", () => {
    const optionalKeys = QUESTIONS.filter((q) => q.optional).map((q) => q.key);
    expect(optionalKeys).toEqual(expect.arrayContaining(["locomotion", "screenZone", "bodyShape", "colorTag"]));
    expect(optionalKeys).not.toContain("functionalGroup");
  });
});
