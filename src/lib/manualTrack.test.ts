import { describe, expect, it } from "vitest";
import { manualTrackToBoxes } from "./manualTrack";

describe("manualTrackToBoxes", () => {
  it("maps centre points to zero-size boxes, preserving the centre", () => {
    const boxes = manualTrackToBoxes([
      { frame_clip: 0, x_norm: 0.5, y_norm: 0.4 },
      { frame_clip: 7, x_norm: 0.52, y_norm: 0.41 },
    ]);
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toEqual({
      frame_clip: 0,
      x_norm: 0.5,
      y_norm: 0.4,
      w_norm: 0,
      h_norm: 0,
    });
    // The renderer's centre = x_norm + w_norm / 2 must equal the marked point.
    expect(boxes[1].x_norm + boxes[1].w_norm / 2).toBe(0.52);
    expect(boxes[1].y_norm + boxes[1].h_norm / 2).toBe(0.41);
  });

  it("returns an empty array for no points", () => {
    expect(manualTrackToBoxes([])).toEqual([]);
  });
});

describe("manualTrackToBoxes t_norm passthrough", () => {
  it("preserves t_norm so re-cut clips keep their coverage window", () => {
    // Regression: an earlier version copied only frame_clip/x_norm/y_norm, which
    // silently dropped t_norm. Manual tracks are exactly what the re-cut short
    // clips use, so losing it there would have stretched every one of their
    // trails back across the padding.
    const out = manualTrackToBoxes([
      { frame_clip: 30, x_norm: 0.1, y_norm: 0.2, t_norm: 0.25 },
      { frame_clip: 90, x_norm: 0.3, y_norm: 0.4, t_norm: 0.75 },
    ]);
    expect(out[0].t_norm).toBe(0.25);
    expect(out[1].t_norm).toBe(0.75);
    expect(out[0].w_norm).toBe(0);
    expect(out[0].h_norm).toBe(0);
  });

  it("leaves t_norm undefined when the source track has none", () => {
    const out = manualTrackToBoxes([{ frame_clip: 0, x_norm: 0.5, y_norm: 0.5 }]);
    expect(out[0].t_norm).toBeUndefined();
  });
});
