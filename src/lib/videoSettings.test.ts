import { describe, expect, it } from "vitest";
import {
  PICTURE_MAX,
  PICTURE_MIN,
  VIDEO_SETTING_DEFAULTS,
  VIDEO_SPEEDS,
  stepSpeed,
  videoFilterFor,
  type VideoSpeed,
} from "./videoSettings";

const base = { trace: false, speed: 1 as VideoSpeed, brightness: 0, contrast: 0 };

describe("VIDEO_SPEEDS", () => {
  it("is ascending, so the stepper's +1 really is faster", () => {
    const sorted = [...VIDEO_SPEEDS].sort((a, b) => a - b);
    expect([...VIDEO_SPEEDS]).toEqual(sorted);
  });

  it("contains 1, so normal speed is reachable from both directions", () => {
    expect(VIDEO_SPEEDS).toContain(1);
  });

  it("keeps every previously persisted rate valid", () => {
    // The ladder used to be [0.5, 1, 1.5]. A device that stored one of those
    // must not be silently reset when the ladder widens.
    for (const legacy of [0.5, 1, 1.5] as VideoSpeed[]) {
      expect(VIDEO_SPEEDS).toContain(legacy);
    }
  });
});

describe("stepSpeed", () => {
  it("walks up one rung at a time", () => {
    expect(stepSpeed(0.25, 1)).toBe(0.5);
    expect(stepSpeed(1, 1)).toBe(1.5);
  });

  it("walks down one rung at a time", () => {
    expect(stepSpeed(1, -1)).toBe(0.75);
    expect(stepSpeed(0.5, -1)).toBe(0.25);
  });

  it("clamps at the ends instead of wrapping", () => {
    const slowest = VIDEO_SPEEDS[0];
    const fastest = VIDEO_SPEEDS[VIDEO_SPEEDS.length - 1];
    expect(stepSpeed(slowest, -1)).toBe(slowest);
    expect(stepSpeed(fastest, 1)).toBe(fastest);
  });

  it("reaches every rung by stepping up from the slowest", () => {
    const walked: VideoSpeed[] = [VIDEO_SPEEDS[0]];
    for (let i = 1; i < VIDEO_SPEEDS.length; i++) {
      walked.push(stepSpeed(walked[walked.length - 1], 1));
    }
    expect(walked).toEqual([...VIDEO_SPEEDS]);
  });

  it("recovers to normal speed from a rate that is not on the ladder", () => {
    // Defensive: a hand-edited localStorage value should not strand the stepper.
    expect(stepSpeed(1.25 as VideoSpeed, 1)).toBe(1.5);
    expect(stepSpeed(1.25 as VideoSpeed, -1)).toBe(0.75);
  });
});

describe("videoFilterFor", () => {
  it("returns none when nothing is adjusted, so no filter is composited", () => {
    expect(videoFilterFor(base)).toBe("none");
  });

  it("builds a filter when brightness or contrast is off zero", () => {
    expect(videoFilterFor({ ...base, brightness: 1 })).toContain("brightness(1.04)");
    expect(videoFilterFor({ ...base, contrast: -1 })).toContain("contrast(0.96)");
  });

  it("lifts every clip by half what it used to out of the box (+4%, was +8%)", () => {
    // Every device that has never touched a picture control gets this filter on
    // every clip. On 11 Nov 2026 the old +8% read as washed out on top of the
    // colour rescue baked into the clips, so it was halved.
    expect(videoFilterFor(VIDEO_SETTING_DEFAULTS)).toBe("brightness(1.04) contrast(1.04)");
  });

  it("still reaches the old extremes at the ends of the range", () => {
    expect(videoFilterFor({ ...base, brightness: PICTURE_MAX })).toContain("brightness(1.40)");
    expect(videoFilterFor({ ...base, brightness: PICTURE_MIN })).toContain("brightness(0.60)");
  });
});
