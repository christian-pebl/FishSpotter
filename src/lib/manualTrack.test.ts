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
