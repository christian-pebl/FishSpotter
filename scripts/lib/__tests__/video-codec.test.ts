import { describe, expect, it } from "vitest";
import { PLAYABLE_VIDEO_CODECS, isPlayableCodec } from "../video-codec";

/**
 * The predicate is the whole gate: `checkSnipCodec` is a thin wrapper around it
 * plus an ffprobe call, so the ffprobe path is exercised against real clips
 * rather than here (it needs a multi-megabyte fixture).
 *
 * The case that matters is `mpeg4`. It shipped 52 unplayable Car-Y-Mor clips on
 * 28 Aug 2026 and reads as a perfectly ordinary MP4 everywhere except a
 * browser's decoder.
 */
describe("isPlayableCodec", () => {
  it("accepts H.264, the standing catalogue invariant", () => {
    expect(isPlayableCodec("h264")).toBe(true);
  });

  it("refuses mpeg4, which Chrome cannot decode", () => {
    expect(isPlayableCodec("mpeg4")).toBe(false);
  });

  it("refuses codecs a browser may support but the catalogue does not allow", () => {
    expect(isPlayableCodec("hevc")).toBe(false);
    expect(isPlayableCodec("av1")).toBe(false);
    expect(isPlayableCodec("vp9")).toBe(false);
  });

  it("treats an absent or empty codec as not playable, so a caller must handle it explicitly", () => {
    expect(isPlayableCodec(null)).toBe(false);
    expect(isPlayableCodec(undefined)).toBe(false);
    expect(isPlayableCodec("")).toBe(false);
    expect(isPlayableCodec("   ")).toBe(false);
  });

  it("normalises ffprobe casing and stray whitespace", () => {
    expect(isPlayableCodec("H264")).toBe(true);
    expect(isPlayableCodec(" h264\n")).toBe(true);
  });

  it("keeps the allow-list to H.264 only", () => {
    expect([...PLAYABLE_VIDEO_CODECS]).toEqual(["h264"]);
  });
});
