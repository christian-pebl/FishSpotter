import type { TourSignal } from "@/lib/tour-bus";

export type TourStepId = "clip" | "shape" | "form" | "candidates" | "guide" | "reveal";

export type StepCopy = {
  eyebrow: string;
  title: string;
  body: string;
};

export type TourStep = {
  id: TourStepId;
  /**
   * `data-tour` keys in priority order. The first one on screen wins.
   *
   * The LAST entry is always the recovery anchor (`clip`): if the user closes
   * the gate a step is describing, the spotlight falls back to the clip and the
   * caption swaps to `recovery` copy, rather than dimming the whole screen with
   * a hole around nothing.
   */
  anchors: string[];
  /** How the ghost cursor mimes this step. Omit for steps with no gesture. */
  cursor?: {
    mode: "click" | "scroll";
    /** Aim at this `data-tour-tile` when the tutorial clip is pinned. */
    hint?: "shape" | "form";
  };
  /** Signals that mean "the app is now AT this step", so the tour jumps here. */
  entersOn: TourSignal[];
  copy: StepCopy;
  recovery?: StepCopy;
  /** Forward button label. Null on steps the app itself advances. */
  nextLabel: string | null;
};

/**
 * The tile the ghost cursor points at, but ONLY when the pinned tutorial clip
 * is the one on screen. Any other clip and the cursor falls back to circling
 * the grid, because pointing at "Crab" over a clip of a pollack would be
 * teaching the wrong answer on the user's very first identification.
 */
export const TUTORIAL_HINTS: Record<"shape" | "form", string> = {
  shape: "crab",
  form: "broad-carapace",
};

const RECOVERY: StepCopy = {
  eyebrow: "Pick it back up",
  title: "Tap the clip when you are ready",
  body: "You closed the selector. Tap the clip to open it again and carry on where you left off.",
};

/**
 * The first-run tour, six steps, ending on the community consensus.
 *
 * Every step points at a REAL element of the shipping app (see the `data-tour`
 * attributes on FeedCard, TileGate, SpeciesComparison, SpeciesGuidePopup and
 * RevealResult). Nothing here is a mock, which is the whole point: the previous
 * tour drew its own copy of the feed card and drifted out of date within weeks.
 *
 * Pebbles are deliberately NOT a step. They are a non-blocking hint that
 * appears on the header bag once the tour is already complete (`PebbleHint`),
 * so nobody has to click anything extra to be finished.
 */
export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "clip",
    anchors: ["clip"],
    cursor: { mode: "click" },
    entersOn: [],
    copy: {
      eyebrow: "1 · Watch",
      title: "This is real survey footage",
      body: "Every clip comes off a PEBL seabed camera on a working farm, so what you call it becomes real monitoring data. Tap the clip to start identifying.",
    },
    nextLabel: null,
  },
  {
    id: "shape",
    anchors: ["tiles", "clip"],
    cursor: { mode: "click", hint: "shape" },
    entersOn: ["identify-opened"],
    copy: {
      eyebrow: "2 · Shape first",
      title: "Start with the shape",
      body: "You do not need the name yet. Pick the rough shape you saw and the app narrows it down from there. Not sure? Every tile has a way out.",
    },
    recovery: RECOVERY,
    nextLabel: null,
  },
  {
    id: "form",
    anchors: ["tiles", "clip"],
    cursor: { mode: "click", hint: "form" },
    entersOn: ["form-gate-open"],
    copy: {
      eyebrow: "3 · Narrow it",
      title: "One more cut",
      body: "Now the coarse family. Tap a row's chevron to see examples first if you want to check yourself before committing.",
    },
    recovery: RECOVERY,
    nextLabel: null,
  },
  {
    id: "candidates",
    anchors: ["tiles", "clip"],
    cursor: { mode: "scroll" },
    entersOn: ["candidates-open"],
    copy: {
      eyebrow: "4 · The look-alikes",
      title: "Only the plausible ones are left",
      body: "Scroll the photos and tap one to read it up close. When two of them will not separate, use Compare side by side underneath.",
    },
    recovery: RECOVERY,
    nextLabel: null,
  },
  {
    id: "guide",
    anchors: ["comparison", "species-guide", "clip"],
    cursor: { mode: "scroll" },
    entersOn: ["comparison-opened", "guide-opened"],
    copy: {
      eyebrow: "5 · Check it",
      title: "Everything we know, right here",
      body: "Photos, the marks that give it away, where it lives and how it behaves. Scroll it, and when you are happy, lock your pick in at the bottom.",
    },
    recovery: RECOVERY,
    nextLabel: null,
  },
  {
    id: "reveal",
    anchors: ["reveal", "clip"],
    entersOn: ["committed"],
    copy: {
      eyebrow: "6 · The verdict",
      title: "There is no answer key",
      body: "PEBL does not hand down a correct answer. The crowd is the authority: here is what every other spotter called this clip. Agree with the community and you are paid again later, when the consensus settles.",
    },
    nextLabel: "Done",
  },
] as const;

export const STEP_COUNT = TOUR_STEPS.length;

/** Index of the step a signal moves the tour to, or -1 if it maps to none. */
export function stepForSignal(signal: TourSignal): number {
  return TOUR_STEPS.findIndex((s) => s.entersOn.includes(signal));
}
