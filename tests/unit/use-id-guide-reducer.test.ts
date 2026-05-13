import { describe, it, expect } from "vitest";
import { reducer, initState } from "@/components/id-guide/useIdGuide";

const fresh = () => initState();

describe("useIdGuide reducer", () => {
  it("initial state is on questions, index 0, no answers", () => {
    const s = fresh();
    expect(s.stage).toBe("questions");
    expect(s.questionIndex).toBe(0);
    expect(s.answers).toEqual({});
    expect(s.candidates).toEqual([]);
  });

  it("answer advances index and records the answer", () => {
    const s1 = reducer(fresh(), { type: "answer", key: "functionalGroup", value: "crab" });
    expect(s1.answers).toEqual({ functionalGroup: "crab" });
    expect(s1.questionIndex).toBe(1);
    expect(s1.stage).toBe("questions");
  });

  it("answering the last visible question transitions to loading", () => {
    // fish path → all 5 questions visible
    let s = fresh();
    s = reducer(s, { type: "answer", key: "functionalGroup", value: "fish" });
    s = reducer(s, { type: "answer", key: "locomotion", value: "swimming" });
    s = reducer(s, { type: "answer", key: "screenZone", value: "midwater" });
    s = reducer(s, { type: "answer", key: "bodyShape", value: "streamlined" });
    s = reducer(s, { type: "answer", key: "colorTag", value: "silvery" });
    expect(s.stage).toBe("loading");
    expect(s.answers).toEqual({
      functionalGroup: "fish",
      locomotion: "swimming",
      screenZone: "midwater",
      bodyShape: "streamlined",
      colorTag: "silvery",
    });
  });

  it("gastropod path skips bodyShape (4 visible questions, not 5)", () => {
    let s = fresh();
    s = reducer(s, { type: "answer", key: "functionalGroup", value: "gastropod" });
    s = reducer(s, { type: "answer", key: "locomotion", value: "crawling" });
    s = reducer(s, { type: "answer", key: "screenZone", value: "seabed" });
    // After 3 answers, we should be on Q4 in the visible list — but for gastropod that's colorTag
    s = reducer(s, { type: "answer", key: "colorTag", value: "sandy" });
    expect(s.stage).toBe("loading");
  });

  it("skip advances without recording", () => {
    let s = fresh();
    s = reducer(s, { type: "answer", key: "functionalGroup", value: "fish" });
    s = reducer(s, { type: "skip" });
    expect(s.questionIndex).toBe(2);
    expect(s.answers).toEqual({ functionalGroup: "fish" });
    expect(s.stage).toBe("questions");
  });

  it("back goes to previous question and drops the answer", () => {
    let s = fresh();
    s = reducer(s, { type: "answer", key: "functionalGroup", value: "fish" });
    s = reducer(s, { type: "answer", key: "locomotion", value: "swimming" });
    expect(s.questionIndex).toBe(2);
    expect(s.answers.locomotion).toBe("swimming");

    s = reducer(s, { type: "back" });
    expect(s.questionIndex).toBe(1);
    expect(s.answers.locomotion).toBeUndefined();
    expect(s.answers.functionalGroup).toBe("fish");
    expect(s.stage).toBe("questions");
  });

  it("back at index 0 is a no-op", () => {
    const s = reducer(fresh(), { type: "back" });
    expect(s).toEqual(fresh());
  });

  it("goToResults transitions to loading", () => {
    let s = fresh();
    s = reducer(s, { type: "answer", key: "functionalGroup", value: "crab" });
    s = reducer(s, { type: "goToResults" });
    expect(s.stage).toBe("loading");
  });

  it("results action with candidates lands on results stage", () => {
    const s = reducer(
      { ...fresh(), stage: "loading" },
      { type: "results", candidates: [{ taxon: { id: "x" } as any, matchScore: 1, priorScore: 0.5, finalScore: 0.85, matchReasons: [] }] },
    );
    expect(s.stage).toBe("results");
    expect(s.candidates.length).toBe(1);
  });

  it("results action with empty array lands on noMatch stage", () => {
    const s = reducer({ ...fresh(), stage: "loading" }, { type: "results", candidates: [] });
    expect(s.stage).toBe("noMatch");
  });

  it("error action records the message and stage", () => {
    const s = reducer({ ...fresh(), stage: "loading" }, { type: "error", message: "bad" });
    expect(s.stage).toBe("error");
    expect(s.errorMessage).toBe("bad");
  });

  it("reject from results goes back to questions", () => {
    let s: ReturnType<typeof fresh> = { ...fresh(), stage: "results", candidates: [{} as any], questionIndex: 4 };
    s = reducer(s, { type: "reject" });
    expect(s.stage).toBe("questions");
    expect(s.candidates).toEqual([]);
  });

  it("reset clears state to a fresh initial state (prefill is NOT recorded as an answer)", () => {
    let s = fresh();
    s = reducer(s, { type: "answer", key: "functionalGroup", value: "fish" });
    s = reducer(s, { type: "reset" });
    expect(s.questionIndex).toBe(0);
    expect(s.answers).toEqual({});
    expect(s.stage).toBe("questions");
  });

  it("initState always returns blank answers — prefill is a render-time suggestion only", () => {
    const s = initState();
    expect(s.answers).toEqual({});
    expect(s.stage).toBe("questions");
  });
});
