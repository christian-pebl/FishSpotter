import { describe, expect, it } from "vitest";
import { isLikelyMobileUserAgent } from "./device-guess";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_PHONE =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";
const MAC_DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const WINDOWS_DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
// Modern iPadOS Safari presents as Mac Safari by default; deliberately NOT
// classified as mobile (see the module doc).
const IPAD_MODERN = MAC_DESKTOP;

describe("isLikelyMobileUserAgent", () => {
  it("recognises real phone UAs", () => {
    expect(isLikelyMobileUserAgent(IPHONE)).toBe(true);
    expect(isLikelyMobileUserAgent(ANDROID_PHONE)).toBe(true);
  });

  it("does not flag desktop browsers", () => {
    expect(isLikelyMobileUserAgent(MAC_DESKTOP)).toBe(false);
    expect(isLikelyMobileUserAgent(WINDOWS_DESKTOP)).toBe(false);
  });

  it("treats a modern iPad as desktop, since that's what its own UA claims to be", () => {
    expect(isLikelyMobileUserAgent(IPAD_MODERN)).toBe(false);
  });

  it("defaults to desktop when there is no signal at all", () => {
    // Uncertain must never mean "guess mobile and downgrade quality".
    expect(isLikelyMobileUserAgent(null)).toBe(false);
    expect(isLikelyMobileUserAgent(undefined)).toBe(false);
    expect(isLikelyMobileUserAgent("")).toBe(false);
  });
});
