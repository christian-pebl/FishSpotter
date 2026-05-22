import { describe, expect, it } from "vitest";
import { generateCronSecret } from "../cron-secret";

describe("generateCronSecret", () => {
  it("returns a 64-character hex string", () => {
    const s = generateCronSecret();
    expect(s).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns different values on every call", () => {
    const a = generateCronSecret();
    const b = generateCronSecret();
    expect(a).not.toBe(b);
  });
});
