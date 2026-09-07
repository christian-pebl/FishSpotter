import { describe, expect, it } from "vitest";
import { chooseVideoSrc } from "./video-rendition-select";

const snippet = { videoUrl: "https://cdn/master.mp4", videoUrlSd: "https://cdn/sd.mp4" };
const noSd = { videoUrl: "https://cdn/master.mp4", videoUrlSd: null };

describe("chooseVideoSrc", () => {
  it("gives desktop the full master, unconditionally", () => {
    expect(chooseVideoSrc(snippet, { isDesktop: true, sdFailed: false })).toEqual({
      src: snippet.videoUrl,
      isSd: false,
    });
    // Even if the SD source has never errored, desktop is never offered it.
    expect(chooseVideoSrc(snippet, { isDesktop: true, sdFailed: false }).isSd).toBe(false);
  });

  it("gives a phone the SD rendition when one exists", () => {
    expect(chooseVideoSrc(snippet, { isDesktop: false, sdFailed: false })).toEqual({
      src: snippet.videoUrlSd,
      isSd: true,
    });
  });

  it("falls back to the master on a phone when no SD rendition exists yet", () => {
    // A clip added before the next backfill run, or one whose encode failed.
    expect(chooseVideoSrc(noSd, { isDesktop: false, sdFailed: false })).toEqual({
      src: noSd.videoUrl,
      isSd: false,
    });
  });

  it("falls back to the master once the SD source has already failed once", () => {
    expect(chooseVideoSrc(snippet, { isDesktop: false, sdFailed: true })).toEqual({
      src: snippet.videoUrl,
      isSd: false,
    });
  });
});
