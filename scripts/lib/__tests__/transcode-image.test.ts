import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  DEFAULT_WEBP_QUALITY,
  sourceHash,
  transcodeAllSizes,
  transcodeToWebp,
  WEBP_SIZES,
} from "../transcode-image";

// A real (tiny) JPEG fixture generated in-memory, so the test exercises the
// actual sharp decode -> resize -> webp-encode path with no network or disk.
async function makeJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 30, g: 120, b: 110 },
    },
  })
    .jpeg()
    .toBuffer();
}

function isWebp(buf: Buffer): boolean {
  // RIFF....WEBP magic: bytes 0-3 "RIFF", bytes 8-11 "WEBP".
  return (
    buf.length > 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  );
}

describe("sourceHash", () => {
  it("is deterministic and 32 hex chars", () => {
    const h = sourceHash("https://example.com/photo.jpg");
    expect(h).toMatch(/^[0-9a-f]{32}$/);
    expect(sourceHash("https://example.com/photo.jpg")).toBe(h);
  });

  it("differs for different URLs", () => {
    expect(sourceHash("https://a.com/1.jpg")).not.toBe(sourceHash("https://a.com/2.jpg"));
  });
});

describe("transcodeToWebp", () => {
  it("emits a valid WebP and downsizes a large source to maxWidth", async () => {
    const src = await makeJpeg(1200, 800);
    const out = await transcodeToWebp(src, WEBP_SIZES.thumb);
    expect(isWebp(out.data)).toBe(true);
    expect(out.width).toBe(WEBP_SIZES.thumb);
    expect(out.height).toBe(Math.round((WEBP_SIZES.thumb / 1200) * 800)); // aspect preserved
    expect(out.bytes).toBe(out.data.length);
  });

  it("never upscales a source already smaller than maxWidth", async () => {
    const src = await makeJpeg(120, 90);
    const out = await transcodeToWebp(src, WEBP_SIZES.medium);
    expect(out.width).toBe(120); // withoutEnlargement
  });

  it("defaults to the documented quality constant without throwing", async () => {
    const src = await makeJpeg(300, 300);
    const out = await transcodeToWebp(src, 200, DEFAULT_WEBP_QUALITY);
    expect(out.width).toBe(200);
  });
});

describe("transcodeAllSizes", () => {
  it("produces both UI sizes from one source", async () => {
    const src = await makeJpeg(1000, 1000);
    const all = await transcodeAllSizes(src);
    expect(all.thumb.width).toBe(WEBP_SIZES.thumb);
    expect(all.medium.width).toBe(WEBP_SIZES.medium);
    expect(isWebp(all.thumb.data)).toBe(true);
    expect(isWebp(all.medium.data)).toBe(true);
  });
});
