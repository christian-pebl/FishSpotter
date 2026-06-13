import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  generateToken,
  hashToken,
  PASSWORD_RESET_TOKEN_TTL_MS,
  VERIFICATION_TOKEN_TTL_MS,
} from "./tokens";

const HEX_64 = /^[0-9a-f]{64}$/;

describe("generateToken", () => {
  it("returns 64 lowercase hex chars (32 random bytes)", () => {
    const token = generateToken();
    expect(token).toMatch(HEX_64);
    expect(token).toHaveLength(64);
  });

  it("produces a different token on every call (randomness)", () => {
    // Generate a batch and assert they are all distinct. A collision here would
    // mean the source entropy is broken; 32 random bytes makes that effectively
    // impossible, so any duplicate is a real fault rather than flake.
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken()));
    expect(tokens.size).toBe(100);
  });
});

describe("hashToken (SHA-256 at rest)", () => {
  it("is deterministic: the same input yields the same hash", () => {
    const plain = "a-fixed-token-value";
    expect(hashToken(plain)).toBe(hashToken(plain));
  });

  it("returns a 64-char hex digest", () => {
    expect(hashToken("anything")).toMatch(HEX_64);
  });

  it("stores the hash, never the raw token (hash differs from input)", () => {
    const plain = generateToken();
    const hashed = hashToken(plain);
    // The value persisted at rest must not equal the plain token, so a DB leak
    // does not hand over a live link.
    expect(hashed).not.toBe(plain);
  });

  it("is genuinely SHA-256 (matches an independent node:crypto digest)", () => {
    const plain = "verify-this-is-sha256";
    const expected = createHash("sha256").update(plain).digest("hex");
    expect(hashToken(plain)).toBe(expected);
  });

  it("is collision-distinct for different inputs", () => {
    expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
  });

  it("round-trips a freshly generated token: rehashing the same plain matches", () => {
    // Models the consume path: hash the incoming plain token and compare to the
    // stored hash. Hashing the same plain again must reproduce the stored value.
    const plain = generateToken();
    const stored = hashToken(plain);
    expect(hashToken(plain)).toBe(stored);
  });
});

describe("token TTL constants", () => {
  it("sets the email-verification TTL to 24 hours", () => {
    expect(VERIFICATION_TOKEN_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("sets the password-reset TTL to 1 hour", () => {
    expect(PASSWORD_RESET_TOKEN_TTL_MS).toBe(60 * 60 * 1000);
  });

  it("makes the reset window shorter than the verification window", () => {
    // Reset links are higher-risk, so the shorter TTL is the intended invariant.
    expect(PASSWORD_RESET_TOKEN_TTL_MS).toBeLessThan(VERIFICATION_TOKEN_TTL_MS);
  });
});
