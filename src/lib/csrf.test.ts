import { describe, expect, it } from "vitest";
import { assertSameOrigin } from "./csrf";

// assertSameOrigin takes a Web `Request`. We only ever read three headers
// (host, origin, referer), so a bare Request with a headers bag is enough;
// the URL passed to the constructor is irrelevant to the function.
function reqWith(headers: Record<string, string>): Request {
  return new Request("https://example.test/api/anything", {
    method: "POST",
    headers,
  });
}

describe("assertSameOrigin", () => {
  it("passes when the Origin host matches the Host header", () => {
    expect(
      assertSameOrigin(
        reqWith({ host: "fish-spotter.app", origin: "https://fish-spotter.app" }),
      ),
    ).toBe(true);
  });

  it("matches on host (port included), so the same host on different schemes still passes", () => {
    // originHostMatches compares URL.host, which is host[:port] and excludes
    // the scheme. http vs https on the same host:port therefore matches.
    expect(
      assertSameOrigin(
        reqWith({ host: "localhost:3000", origin: "http://localhost:3000" }),
      ),
    ).toBe(true);
  });

  it("fails when the Origin host differs from the Host header", () => {
    expect(
      assertSameOrigin(
        reqWith({ host: "fish-spotter.app", origin: "https://evil.example" }),
      ),
    ).toBe(false);
  });

  it("fails when the Origin host matches but the port differs", () => {
    // URL.host includes the port, so a port mismatch is a host mismatch.
    expect(
      assertSameOrigin(
        reqWith({ host: "localhost:3000", origin: "http://localhost:4000" }),
      ),
    ).toBe(false);
  });

  it("falls back to Referer and passes when its host matches (Origin absent)", () => {
    expect(
      assertSameOrigin(
        reqWith({
          host: "fish-spotter.app",
          referer: "https://fish-spotter.app/feed",
        }),
      ),
    ).toBe(true);
  });

  it("falls back to Referer and fails when its host differs (Origin absent)", () => {
    expect(
      assertSameOrigin(
        reqWith({
          host: "fish-spotter.app",
          referer: "https://evil.example/feed",
        }),
      ),
    ).toBe(false);
  });

  it("prefers Origin over Referer when both are present", () => {
    // A matching Referer must not rescue a mismatched Origin: the Origin
    // branch returns first and decides the verdict.
    expect(
      assertSameOrigin(
        reqWith({
          host: "fish-spotter.app",
          origin: "https://evil.example",
          referer: "https://fish-spotter.app/feed",
        }),
      ),
    ).toBe(false);
  });

  it("fails closed when both Origin and Referer are absent", () => {
    // The deliberate fail-closed: a state-changing request with neither
    // header is rejected rather than waved through.
    expect(assertSameOrigin(reqWith({ host: "fish-spotter.app" }))).toBe(false);
  });

  it("fails when the Host header itself is missing", () => {
    expect(
      assertSameOrigin(reqWith({ origin: "https://fish-spotter.app" })),
    ).toBe(false);
  });

  it("fails on a malformed Origin value (unparseable URL)", () => {
    expect(
      assertSameOrigin(
        reqWith({ host: "fish-spotter.app", origin: "not a url" }),
      ),
    ).toBe(false);
  });

  it("fails on a malformed Referer value when Origin is absent", () => {
    expect(
      assertSameOrigin(
        reqWith({ host: "fish-spotter.app", referer: "::::garbled::::" }),
      ),
    ).toBe(false);
  });

  it("fails on a garbled Host that cannot match a well-formed Origin", () => {
    // A nonsense Host string won't equal the parsed Origin's host, so reject.
    expect(
      assertSameOrigin(
        reqWith({ host: "@@@bad host@@@", origin: "https://fish-spotter.app" }),
      ),
    ).toBe(false);
  });
});
