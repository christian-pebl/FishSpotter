import type { ShapeClass } from "@/lib/idguide/traits";
import type { TraitKey } from "@/lib/idguide/narrow";

/**
 * The "Spot It" rung flow as a pure reducer.
 *
 * Before this, FeedCard tracked the funnel with six independent `useState`
 * flags + two hand-written reset helpers, and every transition was an inline
 * cluster of setter calls scattered across the render tree. That made the
 * sequence impossible to test and easy to get subtly wrong (a missed reset, a
 * stale formSeed). This module pulls the *transitions* into one tested place;
 * FeedCard keeps the same derived booleans (via destructuring) so the JSX and
 * its guard expressions are unchanged.
 *
 * The state intentionally keeps the four "which surface is open" booleans
 * rather than a single discriminator, so it is a faithful 1:1 of the previous
 * behaviour (only one is ever true at a time in practice, but encoding them
 * explicitly means the wiring is a pure rename, not a re-model).
 *
 * Rungs: 1 = shape gate, 2 = body-shape gate, 3 = candidate gate; MCQ is the
 * "skip to guess" fast path. `selectedShape` null = the user chose "Not sure"
 * (the candidate gate then narrows the whole catalogue).
 */

export type FormSeed = { key: TraitKey; value: string | null };

export type FlowState = {
  shapeGateOpen: boolean; // Rung 1 visible
  bodyGateOpen: boolean; // Rung 2 visible
  spotItActive: boolean; // Rung 3 (candidate gate) visible
  guessMode: boolean; // MCQ fast path visible
  selectedShape: ShapeClass | null;
  formSeed: FormSeed | null;
};

export const initialFlowState: FlowState = {
  shapeGateOpen: false,
  bodyGateOpen: false,
  spotItActive: false,
  guessMode: false,
  selectedShape: null,
  formSeed: null,
};

export type FlowAction =
  // Open Rung 1 (from the collapsed bar or the "change shape" control).
  | { type: "openShapeGate" }
  // Rung 1 pick. `hasSubSplit` = does this class have a discriminating body
  // form gate (Rung 2)? If so go to Rung 2, else straight to Rung 3.
  | { type: "selectShape"; shape: ShapeClass | null; hasSubSplit: boolean }
  | { type: "closeShapeGate" }
  // Rung 2 pick — seed Rung 3's narrowing with the chosen body form.
  | { type: "selectForm"; seed: FormSeed }
  | { type: "closeBodyGate" }
  | { type: "closeCandidates" }
  // "Skip to guess" from any rung → the MCQ fast path.
  | { type: "skipToMcq" }
  // Enter MCQ directly (the in-panel "guess instead" button).
  | { type: "enterMcq" }
  // Breadcrumb back-navigation.
  | { type: "goToRung1" }
  | { type: "goToRung2" };

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "openShapeGate":
      return { ...state, shapeGateOpen: true };

    case "selectShape":
      return {
        ...state,
        selectedShape: action.shape,
        formSeed: null,
        shapeGateOpen: false,
        bodyGateOpen: action.hasSubSplit,
        spotItActive: !action.hasSubSplit,
      };

    case "closeShapeGate":
      return { ...state, shapeGateOpen: false };

    case "selectForm":
      return {
        ...state,
        formSeed: action.seed,
        bodyGateOpen: false,
        spotItActive: true,
      };

    case "closeBodyGate":
      return { ...state, bodyGateOpen: false };

    case "closeCandidates":
      return { ...state, spotItActive: false };

    case "skipToMcq":
      // Close every gate and reveal the MCQ tile grid.
      return {
        ...state,
        shapeGateOpen: false,
        bodyGateOpen: false,
        spotItActive: false,
        guessMode: true,
      };

    case "enterMcq":
      return { ...state, guessMode: true };

    case "goToRung1":
      return {
        ...state,
        spotItActive: false,
        bodyGateOpen: false,
        formSeed: null,
        shapeGateOpen: true,
      };

    case "goToRung2":
      return {
        ...state,
        spotItActive: false,
        shapeGateOpen: false,
        formSeed: null,
        bodyGateOpen: true,
      };

    default: {
      // Exhaustiveness guard — a new action type without a case is a compile error.
      const _never: never = action;
      return state;
    }
  }
}
