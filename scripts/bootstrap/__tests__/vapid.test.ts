import { describe, expect, it } from "vitest";
import { generateVapidKeys, __test__ } from "../vapid";

describe("generateVapidKeys", () => {
  it("returns base64url-encoded public + private keys", async () => {
    const { publicKey, privateKey } = await generateVapidKeys();
    // base64url = [A-Za-z0-9_-]+
    expect(publicKey).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(privateKey).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("public key decodes to 65 bytes (uncompressed P-256 point)", async () => {
    const { publicKey } = await generateVapidKeys();
    const padded = publicKey + "=".repeat((4 - (publicKey.length % 4)) % 4);
    const buf = Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    expect(buf.length).toBe(65);
    expect(buf[0]).toBe(0x04); // uncompressed point marker
  });

  it("private key decodes to 32 bytes", async () => {
    const { privateKey } = await generateVapidKeys();
    const padded = privateKey + "=".repeat((4 - (privateKey.length % 4)) % 4);
    const buf = Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    expect(buf.length).toBe(32);
  });

  it("returns a new keypair on every call", async () => {
    const a = await generateVapidKeys();
    const b = await generateVapidKeys();
    expect(a.publicKey).not.toBe(b.publicKey);
    expect(a.privateKey).not.toBe(b.privateKey);
  });
});

describe("toBase64Url", () => {
  it("strips padding and replaces +/ with -_", () => {
    const input = new Uint8Array([0xfb, 0xff, 0xff]);
    // base64 of 0xfb 0xff 0xff = "+///"
    expect(__test__.toBase64Url(input)).toBe("-___");
  });

  it("empty input is empty output", () => {
    expect(__test__.toBase64Url(new Uint8Array([]))).toBe("");
  });
});
