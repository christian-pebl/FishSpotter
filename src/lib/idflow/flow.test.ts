import { describe, expect, it } from "vitest";
import { flowReducer, initialFlowState, type FlowState, type FormSeed } from "./flow";

const seed: FormSeed = { key: "bodyShape", value: "fusiform" };

// A state with everything "on" so each test can prove which fields an action
// clears vs leaves alone (guards against a forgotten reset).
const busy: FlowState = {
  shapeGateOpen: true,
  bodyGateOpen: true,
  spotItActive: true,
  guessMode: true,
  selectedShape: "fish",
  formSeed: seed,
};

describe("flowReducer", () => {
  it("starts idle (no surface open, no selection)", () => {
    expect(initialFlowState).toEqual({
      shapeGateOpen: false,
      bodyGateOpen: false,
      spotItActive: false,
      guessMode: false,
      selectedShape: null,
      formSeed: null,
    });
  });

  it("openShapeGate opens Rung 1 only", () => {
    const s = flowReducer(initialFlowState, { type: "openShapeGate" });
    expect(s.shapeGateOpen).toBe(true);
    expect(s.bodyGateOpen).toBe(false);
    expect(s.spotItActive).toBe(false);
  });

  describe("selectShape", () => {
    it("with a sub-split goes Rung 1 → Rung 2 and clears any old formSeed", () => {
      const start = flowReducer(initialFlowState, { type: "openShapeGate" });
      const s = flowReducer({ ...start, formSeed: seed }, {
        type: "selectShape",
        shape: "fish",
        hasSubSplit: true,
      });
      expect(s.selectedShape).toBe("fish");
      expect(s.shapeGateOpen).toBe(false);
      expect(s.bodyGateOpen).toBe(true);
      expect(s.spotItActive).toBe(false);
      expect(s.formSeed).toBeNull();
    });

    it("without a sub-split goes Rung 1 → Rung 3 directly", () => {
      const s = flowReducer(initialFlowState, {
        type: "selectShape",
        shape: "crab",
        hasSubSplit: false,
      });
      expect(s.selectedShape).toBe("crab");
      expect(s.shapeGateOpen).toBe(false);
      expect(s.bodyGateOpen).toBe(false);
      expect(s.spotItActive).toBe(true);
    });

    it("supports the 'Not sure' choice (null shape) → Rung 3 over the whole catalogue", () => {
      const s = flowReducer(initialFlowState, {
        type: "selectShape",
        shape: null,
        hasSubSplit: false,
      });
      expect(s.selectedShape).toBeNull();
      expect(s.spotItActive).toBe(true);
    });
  });

  it("selectForm seeds Rung 3 and moves Rung 2 → Rung 3", () => {
    const s = flowReducer({ ...initialFlowState, bodyGateOpen: true, selectedShape: "fish" }, {
      type: "selectForm",
      seed,
    });
    expect(s.formSeed).toEqual(seed);
    expect(s.bodyGateOpen).toBe(false);
    expect(s.spotItActive).toBe(true);
    expect(s.selectedShape).toBe("fish"); // preserved
  });

  it("close actions dismiss exactly one surface", () => {
    expect(flowReducer(busy, { type: "closeShapeGate" }).shapeGateOpen).toBe(false);
    expect(flowReducer(busy, { type: "closeBodyGate" }).bodyGateOpen).toBe(false);
    expect(flowReducer(busy, { type: "closeCandidates" }).spotItActive).toBe(false);
    // closeCandidates leaves the selection intact (reveal still needs it).
    expect(flowReducer(busy, { type: "closeCandidates" }).selectedShape).toBe("fish");
  });

  it("skipToMcq closes every gate and enters the MCQ fast path", () => {
    const s = flowReducer(busy, { type: "skipToMcq" });
    expect(s.shapeGateOpen).toBe(false);
    expect(s.bodyGateOpen).toBe(false);
    expect(s.spotItActive).toBe(false);
    expect(s.guessMode).toBe(true);
  });

  it("enterMcq sets guess mode without touching the gates", () => {
    const s = flowReducer({ ...initialFlowState, shapeGateOpen: false }, { type: "enterMcq" });
    expect(s.guessMode).toBe(true);
  });

  describe("breadcrumb back-navigation", () => {
    it("goToRung1 reopens the shape gate and clears downstream state", () => {
      const s = flowReducer(busy, { type: "goToRung1" });
      expect(s.shapeGateOpen).toBe(true);
      expect(s.bodyGateOpen).toBe(false);
      expect(s.spotItActive).toBe(false);
      expect(s.formSeed).toBeNull();
    });

    it("goToRung2 reopens the body gate and clears the form seed", () => {
      const s = flowReducer(busy, { type: "goToRung2" });
      expect(s.bodyGateOpen).toBe(true);
      expect(s.shapeGateOpen).toBe(false);
      expect(s.spotItActive).toBe(false);
      expect(s.formSeed).toBeNull();
    });
  });

  it("is pure — does not mutate the input state", () => {
    const snapshot = JSON.parse(JSON.stringify(busy));
    flowReducer(busy, { type: "skipToMcq" });
    flowReducer(busy, { type: "goToRung1" });
    expect(busy).toEqual(snapshot);
  });

  it("models a full Rung 1 → 2 → 3 walk", () => {
    let s = flowReducer(initialFlowState, { type: "openShapeGate" });
    s = flowReducer(s, { type: "selectShape", shape: "fish", hasSubSplit: true });
    expect(s.bodyGateOpen).toBe(true);
    s = flowReducer(s, { type: "selectForm", seed });
    expect(s.spotItActive).toBe(true);
    expect(s.shapeGateOpen).toBe(false);
    expect(s.bodyGateOpen).toBe(false);
    expect(s.selectedShape).toBe("fish");
    expect(s.formSeed).toEqual(seed);
  });
});
