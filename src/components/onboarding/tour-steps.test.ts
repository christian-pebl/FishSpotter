import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { STEP_COUNT, TOUR_STEPS, TUTORIAL_HINTS, stepForSignal } from "./tour-steps";

/**
 * The gate that stops this tour drifting the way the last one did.
 *
 * The tour it replaced was a hand-drawn replica of the feed card. Nothing tied
 * it to the real components, so it quietly went out of date: by August it was
 * teaching a retired answer flow. This tour points at real elements by
 * `data-tour` attribute, and these tests assert those attributes still exist in
 * the source. Rename or delete one and CI fails here, at the rename, rather
 * than months later when someone happens to watch the tour.
 */

const SRC = join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [full] : [];
  });
}

/**
 * Every `data-tour` value written anywhere in `src/`. Scanned off the
 * filesystem rather than shelled out to `git grep`, so it behaves the same on
 * every platform and in a worktree with no git dir.
 *
 * Matches both spellings, because two of the anchors are conditional: the feed
 * keeps neighbouring cards mounted, so the clip and reveal anchors are spread
 * from an object (`{...(isActive ? { "data-tour": "clip" } : {})}`) to keep the
 * attribute on the ACTIVE card only. A regex that only knew the plain JSX form
 * would silently miss them and pass a test that proves nothing.
 */
function anchorValues(): Set<string> {
  const pattern = /data-tour"?\s*[:=]\s*"([a-z-]+)"/g;
  const found = new Set<string>();
  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(pattern)) found.add(m[1]);
  }
  return found;
}

/** Is the per-tile attribute still wired up at all? Its values come from a
 *  variable (`data-tour-tile={tile.key}`), so they cannot be scanned for. */
function tileAttributeWired(): boolean {
  return sourceFiles(SRC).some((f) => readFileSync(f, "utf8").includes("data-tour-tile="));
}

describe("tour steps", () => {
  const anchorsInSource = anchorValues();

  it("has six steps, ending on the reveal", () => {
    expect(STEP_COUNT).toBe(6);
    expect(TOUR_STEPS[0].id).toBe("clip");
    expect(TOUR_STEPS[STEP_COUNT - 1].id).toBe("reveal");
  });

  it("only the final step offers a forward button", () => {
    // Every other step is advanced by the app itself, which is the whole point:
    // the user does the real thing rather than clicking Next through a slideshow.
    const withNext = TOUR_STEPS.filter((s) => s.nextLabel !== null);
    expect(withNext).toHaveLength(1);
    expect(withNext[0].id).toBe("reveal");
  });

  it("points only at anchors that exist in the app", () => {
    expect(anchorsInSource.size).toBeGreaterThan(0);
    for (const step of TOUR_STEPS) {
      for (const anchor of step.anchors) {
        expect(anchorsInSource, `step "${step.id}" anchor "${anchor}"`).toContain(anchor);
      }
    }
  });

  it("gives every step past the first a recovery anchor and recovery copy", () => {
    // If the user closes the gate a step describes, the spotlight has to land
    // somewhere real. The last anchor is always the clip, and the copy swaps to
    // "tap the clip to pick up where you left off".
    for (const step of TOUR_STEPS.slice(1)) {
      expect(step.anchors.length, `step "${step.id}"`).toBeGreaterThan(1);
      expect(step.anchors[step.anchors.length - 1]).toBe("clip");
      if (step.id !== "reveal") expect(step.recovery, `step "${step.id}"`).toBeTruthy();
    }
  });

  it("keeps the per-tile anchor wired, and names real gate keys", () => {
    expect(tileAttributeWired()).toBe(true);
    // The cursor hints are gate keys, not free text: "crab" is a ShapeClass and
    // "broad-carapace" is a crab body-form option. Both are asserted here so a
    // rename in the gate config surfaces as a failing tour test.
    expect(TUTORIAL_HINTS.shape).toBe("crab");
    expect(TUTORIAL_HINTS.form).toBe("broad-carapace");
  });

  it("maps each entry signal to exactly one step", () => {
    const seen = new Map<string, string>();
    for (const step of TOUR_STEPS) {
      for (const signal of step.entersOn) {
        expect(seen.has(signal), `"${signal}" claimed by ${seen.get(signal)}`).toBe(false);
        seen.set(signal, step.id);
        expect(stepForSignal(signal)).toBe(TOUR_STEPS.indexOf(step));
      }
    }
    // Both routes into the species page land on the same step.
    expect(stepForSignal("comparison-opened")).toBe(stepForSignal("guide-opened"));
  });

  it("lets a committed guess jump straight to the reveal", () => {
    // The "skip to guess" fast path bypasses rungs 2 and 3 entirely, so the
    // only thing keeping the tour coherent is that `committed` jumps forward
    // rather than advancing by one.
    expect(stepForSignal("committed")).toBe(STEP_COUNT - 1);
  });
});
