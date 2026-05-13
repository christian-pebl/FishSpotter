import { describe, it, expect } from "vitest";
import { deriveIdGuidePrefill, type BBoxLike } from "@/lib/id-guide-prefill";

/** Helper: build a bbox track of N frames with constant per-frame motion vector. */
function track(opts: {
  count: number;
  startX?: number;
  startY?: number;
  dx?: number;
  dy?: number;
  w?: number;
  h?: number;
  jitter?: number;
}): BBoxLike[] {
  const { count, startX = 0.4, startY = 0.5, dx = 0, dy = 0, w = 0.05, h = 0.05, jitter = 0 } = opts;
  return Array.from({ length: count }, (_, i) => {
    const noise = jitter ? (Math.sin(i * 7.13) * jitter) : 0;
    return {
      frame_clip: i,
      x_norm: startX + dx * i + noise,
      y_norm: startY + dy * i,
      w_norm: w,
      h_norm: h,
    };
  });
}

describe("deriveIdGuidePrefill", () => {
  it("returns {} for null / empty tracks", () => {
    expect(deriveIdGuidePrefill(null)).toEqual({});
    expect(deriveIdGuidePrefill([])).toEqual({});
  });

  it("single-frame track still suggests screenZone (but no locomotion)", () => {
    // Manual-tracked clips sometimes have only 1 bbox frame — we should still
    // be able to suggest where on screen the creature is, even if we can't
    // infer how it moves.
    const out = deriveIdGuidePrefill([
      { frame_clip: 0, x_norm: 0.4, y_norm: 0.72, w_norm: 0.05, h_norm: 0.05 }, // centre y = 0.745 → seabed
    ]);
    expect(out.screenZone).toBe("seabed");
    expect(out.locomotion).toBeUndefined();
  });

  it("seabed crab (low motion, near bottom) → seabed + crawling", () => {
    // centre y ≈ 0.7, small horizontal drift
    const bboxes = track({ count: 30, startY: 0.67, startX: 0.2, dx: 0.001 });
    const out = deriveIdGuidePrefill(bboxes);
    expect(out.screenZone).toBe("seabed");
    expect(out.locomotion).toBe("crawling");
  });

  it("midwater swimming fish (steady horizontal motion) → midwater + swimming", () => {
    // centre y ≈ 0.45, steady ~0.005 per frame
    const bboxes = track({ count: 30, startY: 0.42, startX: 0.1, dx: 0.005 });
    const out = deriveIdGuidePrefill(bboxes);
    expect(out.screenZone).toBe("midwater");
    expect(out.locomotion).toBe("swimming");
  });

  it("near-stationary creature → stationary regardless of zone", () => {
    const bboxes = track({ count: 20, startY: 0.5, dx: 0, dy: 0 });
    const out = deriveIdGuidePrefill(bboxes);
    expect(out.locomotion).toBe("stationary");
  });

  it("near-surface drift → surface", () => {
    const bboxes = track({ count: 20, startY: 0.20, dx: 0.001 });
    const out = deriveIdGuidePrefill(bboxes);
    expect(out.screenZone).toBe("surface");
  });

  it("bursty motion (high coefficient of variation) → darting", () => {
    // Mostly small drift with occasional big jumps — high CV
    // Mean step needs to clear SWIMMING_MIN (0.003) and CV needs to clear DARTING_CV (1.5)
    const bboxes: BBoxLike[] = [];
    let x = 0.1;
    for (let i = 0; i < 30; i++) {
      // every 5th frame: big jump 0.04; otherwise small drift 0.0005
      x += i % 5 === 0 ? 0.04 : 0.0005;
      bboxes.push({ frame_clip: i, x_norm: x, y_norm: 0.45, w_norm: 0.05, h_norm: 0.05 });
    }
    const out = deriveIdGuidePrefill(bboxes);
    expect(out.locomotion).toBe("darting");
  });

  it("clearly inside the seabed bucket: y centre=0.7 → seabed", () => {
    const bboxes: BBoxLike[] = Array.from({ length: 5 }, (_, i) => ({
      frame_clip: i,
      x_norm: 0.4,
      y_norm: 0.675, // centre 0.7
      w_norm: 0.05,
      h_norm: 0.05,
    }));
    expect(deriveIdGuidePrefill(bboxes).screenZone).toBe("seabed");
  });

  it("clearly inside the surface bucket: y centre=0.3 → surface", () => {
    const bboxes: BBoxLike[] = Array.from({ length: 5 }, (_, i) => ({
      frame_clip: i,
      x_norm: 0.4,
      y_norm: 0.275, // centre 0.3
      w_norm: 0.05,
      h_norm: 0.05,
    }));
    expect(deriveIdGuidePrefill(bboxes).screenZone).toBe("surface");
  });

  it("midwater bucket: y centre=0.5 → midwater", () => {
    const bboxes: BBoxLike[] = Array.from({ length: 5 }, (_, i) => ({
      frame_clip: i,
      x_norm: 0.4,
      y_norm: 0.475,
      w_norm: 0.05,
      h_norm: 0.05,
    }));
    expect(deriveIdGuidePrefill(bboxes).screenZone).toBe("midwater");
  });

  it("ambiguous mid-water with sub-threshold motion: no locomotion suggestion", () => {
    // Mid-water, motion just below stationary cutoff (0.001) and not crawling-on-seabed
    const bboxes: BBoxLike[] = Array.from({ length: 10 }, (_, i) => ({
      frame_clip: i,
      x_norm: 0.4 + i * 0.0005, // mean step 0.0005 < 0.001
      y_norm: 0.45,
      w_norm: 0.05,
      h_norm: 0.05,
    }));
    const out = deriveIdGuidePrefill(bboxes);
    expect(out.screenZone).toBe("midwater");
    expect(out.locomotion).toBe("stationary"); // because <0.001
  });
});
