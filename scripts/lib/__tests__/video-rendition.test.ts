import { describe, expect, it } from "vitest";
import { encodeSdRendition, hasFfmpeg, SD_RENDITION_HEIGHT, SD_RENDITION_WIDTH } from "../video-rendition";

describe("video-rendition constants", () => {
  it("matches the 16:9 scale ffmpeg was told to produce", () => {
    // scale=-2:720 on a 16:9 source yields 1280x720; every live clip is 16:9,
    // so this is exact, not an estimate (src/lib/video-rendition-select.ts
    // and the module doc rely on it being the true encoded width).
    expect(SD_RENDITION_HEIGHT).toBe(720);
    expect(SD_RENDITION_WIDTH).toBe(1280);
    expect(SD_RENDITION_WIDTH / SD_RENDITION_HEIGHT).toBeCloseTo(16 / 9, 2);
  });
});

describe("encodeSdRendition", () => {
  it("fails cleanly (not throws) on a source that does not exist", () => {
    // Real end-to-end encoding is exercised by the production backfill and
    // sync integration, not here (spawning ffmpeg in CI is out of scope for
    // this suite); this just proves the function never throws for a caller
    // that is iterating a batch and must keep going past one bad row.
    const r = encodeSdRendition("Z:/does/not/exist/nope.mp4");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not found|ffmpeg is not on PATH/);
  });

  it("hasFfmpeg is a boolean and does not throw", () => {
    expect(typeof hasFfmpeg()).toBe("boolean");
  });
});
