import { describe, expect, it } from "vitest";
import {
  PIPELINE_RENDER_SUFFIXES,
  isHudBand,
  measureBands,
  pipelineRenderName,
} from "../burn-in";

/**
 * These cover the calibration and the provenance rule, both pure. The pixel
 * path itself is validated against real footage (11 burnt-in NORF-1 clips and
 * their 11 clean re-cuts) rather than here, because it needs ffmpeg and a
 * multi-megabyte fixture; the measured populations it separated are encoded as
 * the constants below.
 */
describe("pipelineRenderName", () => {
  it("flags every pipeline render suffix", () => {
    for (const suffix of PIPELINE_RENDER_SUFFIXES) {
      expect(pipelineRenderName(`NORF-1_2026-06-14_08-01${suffix}.mp4`)).toBe(true);
    }
  });

  it("flags a render given as a full Windows or POSIX path", () => {
    expect(pipelineRenderName("G:\\vids\\NORF-1_2026-06-14_08-01_unified_tracked.mp4")).toBe(true);
    expect(pipelineRenderName("/mnt/vids/NORF-1_2026-06-14_08-01_unified_tracked.mp4")).toBe(true);
  });

  it("passes a clean original, including one whose folder name mentions tracking", () => {
    expect(pipelineRenderName("NORF-1_2026-06-14_08-01.mp4")).toBe(false);
    expect(pipelineRenderName("G:\\unified_tracked\\NORF-1_2026-06-14_08-01.mp4")).toBe(false);
  });

  it("treats a missing provenance record as not-a-render, so the pixels decide", () => {
    expect(pipelineRenderName(null)).toBe(false);
    expect(pipelineRenderName(undefined)).toBe(false);
    expect(pipelineRenderName("")).toBe(false);
  });
});

describe("isHudBand", () => {
  // The measured populations, from the 28 Aug 2026 investigation.
  it("accepts the burnt-in population (black 0.67-0.71, white 0.047-0.051)", () => {
    expect(isHudBand(0.67, 0.047)).toBe(true);
    expect(isHudBand(0.71, 0.051)).toBe(true);
  });

  it("rejects the clean population (black 0.00, white 0.000)", () => {
    expect(isHudBand(0.0, 0.0)).toBe(false);
  });

  /**
   * The regression that matters most: a plain "is the top-left dark?" test gave
   * a false positive on clean murky green footage (a live Skye clip measured
   * mean 68/255 in the band). Darkness alone must never condemn a clip; the
   * white glyph pixels of the HUD text are required too.
   */
  it("rejects dark footage that carries no glyph pixels", () => {
    expect(isHudBand(0.9, 0.0)).toBe(false);
    expect(isHudBand(0.99, 0.014)).toBe(false);
  });

  it("rejects bright footage that carries no dark bar", () => {
    expect(isHudBand(0.1, 0.5)).toBe(false);
  });
});

describe("measureBands", () => {
  const W = 4;
  const H = 2;

  it("splits a buffer into one reading per sampled frame", () => {
    const solidBlack = Buffer.alloc(W * H, 0);
    const solidWhite = Buffer.alloc(W * H, 255);
    const bands = measureBands(Buffer.concat([solidBlack, solidWhite]), W, H);
    expect(bands).toHaveLength(2);
    expect(bands[0]).toEqual({ black: 1, white: 0 });
    expect(bands[1]).toEqual({ black: 0, white: 1 });
  });

  it("counts mid-grey as neither background nor glyph", () => {
    const [band] = measureBands(Buffer.alloc(W * H, 128), W, H);
    expect(band).toEqual({ black: 0, white: 0 });
  });

  it("measures a realistic HUD band as black-dominant with a glyph minority", () => {
    const buf = Buffer.alloc(W * H, 0);
    buf[0] = 255; // one glyph pixel in eight
    const [band] = measureBands(buf, W, H);
    expect(band.black).toBeCloseTo(7 / 8);
    expect(band.white).toBeCloseTo(1 / 8);
    expect(isHudBand(band.black, band.white)).toBe(true);
  });

  it("ignores a trailing partial frame rather than reporting a short band", () => {
    const bands = measureBands(Buffer.alloc(W * H + 3, 0), W, H);
    expect(bands).toHaveLength(1);
  });

  it("returns nothing for an empty buffer or a zero-size band", () => {
    expect(measureBands(Buffer.alloc(0), W, H)).toEqual([]);
    expect(measureBands(Buffer.alloc(8, 0), 0, H)).toEqual([]);
  });
});
