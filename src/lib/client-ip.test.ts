import { describe, expect, it } from "vitest";
import { clientIpKey, clientIpKeyFromHeaders } from "./client-ip";

function reqWith(headers: Record<string, string>): Request {
  return new Request("https://example.test/api/anything", { headers });
}

describe("clientIpKey", () => {
  it("returns the first entry of x-forwarded-for", () => {
    expect(clientIpKey(reqWith({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
  });

  it("trims whitespace around the first entry", () => {
    expect(clientIpKey(reqWith({ "x-forwarded-for": "  1.2.3.4  , 10.0.0.1" }))).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    expect(clientIpKey(reqWith({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
  });

  it("prefers x-forwarded-for over x-real-ip when both are present", () => {
    expect(
      clientIpKey(reqWith({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "5.6.7.8" })),
    ).toBe("1.2.3.4");
  });

  it("falls back to 'unknown' when neither header is present", () => {
    expect(clientIpKey(reqWith({}))).toBe("unknown");
  });

  it("falls back to 'unknown' when x-forwarded-for is present but empty", () => {
    expect(clientIpKey(reqWith({ "x-forwarded-for": "" }))).toBe("unknown");
  });
});

describe("clientIpKeyFromHeaders", () => {
  it("returns the first entry of x-forwarded-for from a plain header object", () => {
    expect(
      clientIpKeyFromHeaders({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }),
    ).toBe("1.2.3.4");
  });

  it("handles NextAuth's array-valued header shape", () => {
    expect(
      clientIpKeyFromHeaders({ "x-forwarded-for": ["1.2.3.4, 10.0.0.1", "ignored-second-value"] }),
    ).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    expect(clientIpKeyFromHeaders({ "x-real-ip": "5.6.7.8" })).toBe("5.6.7.8");
  });

  it("falls back to 'unknown' when headers is undefined", () => {
    expect(clientIpKeyFromHeaders(undefined)).toBe("unknown");
  });

  it("falls back to 'unknown' when neither header is present", () => {
    expect(clientIpKeyFromHeaders({})).toBe("unknown");
  });
});
