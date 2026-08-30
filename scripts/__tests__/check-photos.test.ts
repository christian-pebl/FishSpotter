import { describe, expect, it } from "vitest";
import { looksLikeImage } from "../check-photos";

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64),
]);
const webp = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from("WEBP", "ascii"),
  Buffer.from("VP8 ", "ascii"),
  Buffer.alloc(64),
]);

describe("looksLikeImage", () => {
  it("accepts JPEG, PNG and WebP signatures", () => {
    expect(looksLikeImage(jpeg)).toBe(true);
    expect(looksLikeImage(png)).toBe(true);
    expect(looksLikeImage(webp)).toBe(true);
  });

  it("accepts a small WebP", () => {
    // The reason this check reads the header instead of the length: a 286x177
    // WebP of a simple subject is 2KB, and a byte-count floor of 5KB failed
    // seven perfectly good gallery rows.
    expect(looksLikeImage(Buffer.concat([webp.subarray(0, 16), Buffer.alloc(200)]))).toBe(true);
  });

  it("rejects the HTML error page a rate-limited CDN serves", () => {
    // Wikimedia answers a throttled request with a page, not a picture, and it
    // renders as a broken tile exactly like a 404 would.
    expect(looksLikeImage(Buffer.from("<!DOCTYPE html><html><body>Too many requests", "utf8"))).toBe(false);
  });

  it("rejects an empty or truncated response", () => {
    expect(looksLikeImage(Buffer.alloc(0))).toBe(false);
    expect(looksLikeImage(Buffer.from([0xff, 0xd8]))).toBe(false);
  });
});
