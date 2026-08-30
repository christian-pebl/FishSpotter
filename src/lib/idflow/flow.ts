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

export type FormSeed = {
  key: TraitKey;
  value: string | null;
  /** Every trait value the chosen tile covers. >1 when the tile bundles forms
   * (see body-forms' SubSplit options); undefined/null means just `value`. */
  values?: string[] | null;
};

export type FlowState = {
  shapeGateOpen: boolean; // Rung 1 visible
  bodyGateOpen: boolean; // Rung 2 visible
  spotItActive: boolean; // Rung 3 (candidate gate) visible
  guessMode: boolean; // MCQ fast path visible
  selectedShape: ShapeClass | null;
  formSeed: FormSeed | null;
  /** Rung-3 "rule out" set: scientific names the user has eliminated from the
   * candidate grid for THIS clip. A pure view filter, never sent to the server,
   * with no effect on scoring or consensus. */
  ruledOut: string[];
  /** Which candidate bucket `ruledOut` belongs to (see `bucketKey`). Eliminations
   * survive a round trip back to an earlier rung and forward again into the SAME
   * bucket, which is exactly what a careful spotter does; they are dropped only
   * when the bucket actually changes and the old names no longer apply. */
  ruledOutKey: string | null;
};

/** Identity of the candidate set behind Rung 3: shape class plus the Rung-2 seed
 * (including its bundled values, so two tiles sharing a trait key still key
 * apart). A null shape is the whole-catalogue "Not sure" path; a null seed value
 * is the "compare them all" path within one shape class. */
export function bucketKey(
  shape: ShapeClass | null,
  seed: FormSeed | null,
): string {
  const base = shape ?? "all";
  if (!seed || seed.value === null) return base + ":any";
  const values = seed.values?.length ? seed.values : [seed.value];
  return base + ":" + seed.key + ":" + [...values].sort().join("|");
}

export const initialFlowState: FlowState = {
  shapeGateOpen: false,
  bodyGateOpen: false,
  spotItActive: false,
  guessMode: false,
  selectedShape: null,
  formSeed: null,
  ruledOut: [],
  ruledOutKey: null,
};

export type FlowAction =
  // Open Rung 1 (from the collapsed bar or the "change shape" control).
  | { type: "openShapeGate" }
  // Rung 1 pick. `hasSubSplit` = does this class have a discriminating body
  // form gate (Rung 2)? If so go to Rung 2, else straight to Rung 3.
  | { type: "selectShape"; shape: ShapeClass | null; hasSubSplit: boolean }
  | { type: "closeShapeGate" }
  // Rung 2 pick, seed Rung 3's narrowing with the chosen body form.
  | { type: "selectForm"; seed: FormSeed }
  | { type: "closeBodyGate" }
  | { type: "closeCandidates" }
  // "Skip to guess" from any rung → the MCQ fast path.
  | { type: "skipToMcq" }
  // Enter MCQ directly (the in-panel "guess instead" button).
  | { type: "enterMcq" }
  // Breadcrumb back-navigation.
  | { type: "goToRung1" }
  | { type: "goToRung2" }
  // Rung-3 elimination: rule one candidate out of the grid, put one back, or put
  // them all back. `ruleOut` is idempotent.
  | { type: "ruleOut"; scientificName: string }
  | { type: "restore"; scientificName: string }
  | { type: "restoreAll" }
  // Every surface closed, back to just the clip. Fired when a card scrolls out
  // of the feed: the panel and the rungs are per-clip working state, but the
  // split they hold is GLOBAL, so a card that is no longer on screen must not
  // keep holding it open. Narrowing (`selectedShape`, `formSeed`, `ruledOut`)
  // survives, so scrolling away and back does not throw away the user's work.
  | { type: "closeAll" };

/** Stamp the bucket a set of eliminations belongs to, clearing them when the
 * bucket changed. Same bucket = the user stepped back to look at an earlier rung
 * and came forward again, so their eliminations still mean something and are
 * kept. */
function applyBucket(state: FlowState, key: string): FlowState {
  return key === state.ruledOutKey
    ? state
    : { ...state, ruledOut: [], ruledOutKey: key };
}

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "closeAll":
      return {
        ...state,
        shapeGateOpen: false,
        bodyGateOpen: false,
        spotItActive: false,
        guessMode: false,
      };

    case "openShapeGate":
      return { ...state, shapeGateOpen: true };

    case "selectShape": {
      // With no sub-split this lands straight on Rung 3, so the bucket is
      // settled here; with one, selectForm settles it.
      const next = {
        ...state,
        selectedShape: action.shape,
        formSeed: null,
        shapeGateOpen: false,
        bodyGateOpen: action.hasSubSplit,
        spotItActive: !action.hasSubSplit,
      };
      return action.hasSubSplit
        ? next
        : applyBucket(next, bucketKey(action.shape, null));
    }

    case "closeShapeGate":
      return { ...state, shapeGateOpen: false };

    case "selectForm":
      return applyBucket(
        {
          ...state,
          formSeed: action.seed,
          bodyGateOpen: false,
          spotItActive: true,
        },
        bucketKey(state.selectedShape, action.seed),
      );

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

    case "ruleOut":
      return state.ruledOut.includes(action.scientificName)
        ? state
        : { ...state, ruledOut: [...state.ruledOut, action.scientificName] };

    case "restore":
      return state.ruledOut.includes(action.scientificName)
        ? {
            ...state,
            ruledOut: state.ruledOut.filter((n) => n !== action.scientificName),
          }
        : state;

    case "restoreAll":
      return state.ruledOut.length === 0 ? state : { ...state, ruledOut: [] };

    default: {
      // Exhaustiveness guard, a new action type without a case is a compile error.
      const _never: never = action;
      return state;
    }
  }
}
