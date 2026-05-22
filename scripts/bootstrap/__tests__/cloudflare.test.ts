import { describe, expect, it } from "vitest";
import { CloudflareR2Client } from "../cloudflare-r2";
import { CloudflareDnsClient } from "../cloudflare-dns";

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface MockCall {
  url: string;
  method: string;
  body: unknown;
}

function makeMockFetch(handlers: Array<(req: MockCall) => Response | Promise<Response>>) {
  const calls: MockCall[] = [];
  const fetchImpl: typeof fetch = (async (input, init) => {
    const url = typeof input === "string" ? input : (input as URL).toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const bodyText = typeof init?.body === "string" ? init.body : "";
    const body = bodyText ? JSON.parse(bodyText) : null;
    calls.push({ url, method, body });
    const handler = handlers[calls.length - 1];
    if (!handler) throw new Error(`No mock handler for call #${calls.length}: ${method} ${url}`);
    return handler({ url, method, body });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

describe("CloudflareR2Client.ensureBucket", () => {
  it("creates the bucket when it doesn't exist", async () => {
    const { fetchImpl, calls } = makeMockFetch([
      () => jsonRes(200, { success: true, result: { buckets: [] }, errors: [] }),
      () => jsonRes(200, { success: true, result: { name: "test-bucket" }, errors: [] }),
    ]);
    const client = new CloudflareR2Client({
      apiToken: "tok",
      accountId: "acc_123",
      fetchImpl,
    });
    const res = await client.ensureBucket("test-bucket");
    expect(res.action).toBe("created");
    expect(calls[1].method).toBe("POST");
    expect(calls[1].body).toEqual({ name: "test-bucket" });
  });

  it("is a no-op when the bucket already exists", async () => {
    const { fetchImpl, calls } = makeMockFetch([
      () =>
        jsonRes(200, {
          success: true,
          result: {
            buckets: [{ name: "test-bucket", creation_date: "2026-01-01" }],
          },
          errors: [],
        }),
    ]);
    const client = new CloudflareR2Client({
      apiToken: "tok",
      accountId: "acc_123",
      fetchImpl,
    });
    const res = await client.ensureBucket("test-bucket");
    expect(res.action).toBe("existed");
    expect(calls.length).toBe(1); // no POST
  });

  it("surfaces Cloudflare error messages", async () => {
    const { fetchImpl } = makeMockFetch([
      () =>
        jsonRes(401, {
          success: false,
          result: null,
          errors: [{ code: 10000, message: "Authentication error" }],
        }),
    ]);
    const client = new CloudflareR2Client({
      apiToken: "bad",
      accountId: "acc_x",
      fetchImpl,
    });
    await expect(client.ensureBucket("x")).rejects.toThrow(/Authentication error/);
  });
});

describe("CloudflareDnsClient.findZoneId", () => {
  it("returns null when zone is not on Cloudflare", async () => {
    const { fetchImpl } = makeMockFetch([
      () => jsonRes(200, { success: true, result: [], errors: [] }),
    ]);
    const client = new CloudflareDnsClient({ apiToken: "tok", fetchImpl });
    expect(await client.findZoneId("example.com")).toBeNull();
  });

  it("returns the zone id when found", async () => {
    const { fetchImpl } = makeMockFetch([
      () =>
        jsonRes(200, {
          success: true,
          result: [{ id: "zone_abc", name: "example.com" }],
          errors: [],
        }),
    ]);
    const client = new CloudflareDnsClient({ apiToken: "tok", fetchImpl });
    expect(await client.findZoneId("example.com")).toBe("zone_abc");
  });
});

describe("CloudflareDnsClient.upsertRecord", () => {
  it("is unchanged when an exact-match record exists", async () => {
    const { fetchImpl, calls } = makeMockFetch([
      () =>
        jsonRes(200, {
          success: true,
          result: [
            {
              id: "rec_1",
              zone_id: "zone_abc",
              type: "TXT",
              name: "_dmarc.example.com",
              content: "v=DMARC1; p=none;",
            },
          ],
          errors: [],
        }),
    ]);
    const client = new CloudflareDnsClient({ apiToken: "tok", fetchImpl });
    const r = await client.upsertRecord("zone_abc", {
      type: "TXT",
      name: "_dmarc.example.com",
      content: "v=DMARC1; p=none;",
    });
    expect(r.action).toBe("unchanged");
    expect(calls.length).toBe(1); // only the list call
  });

  it("updates when a same name+type record has a different content", async () => {
    const { fetchImpl, calls } = makeMockFetch([
      () =>
        jsonRes(200, {
          success: true,
          result: [
            {
              id: "rec_1",
              zone_id: "zone_abc",
              type: "TXT",
              name: "_dmarc.example.com",
              content: "old value",
            },
          ],
          errors: [],
        }),
      () => jsonRes(200, { success: true, result: {}, errors: [] }),
    ]);
    const client = new CloudflareDnsClient({ apiToken: "tok", fetchImpl });
    const r = await client.upsertRecord("zone_abc", {
      type: "TXT",
      name: "_dmarc.example.com",
      content: "v=DMARC1; p=quarantine;",
    });
    expect(r.action).toBe("updated");
    expect(calls[1].method).toBe("PATCH");
    expect(calls[1].url).toContain("/dns_records/rec_1");
  });

  it("creates when there is no existing record", async () => {
    const { fetchImpl, calls } = makeMockFetch([
      () => jsonRes(200, { success: true, result: [], errors: [] }),
      () => jsonRes(200, { success: true, result: {}, errors: [] }),
    ]);
    const client = new CloudflareDnsClient({ apiToken: "tok", fetchImpl });
    const r = await client.upsertRecord("zone_abc", {
      type: "TXT",
      name: "_dmarc.example.com",
      content: "v=DMARC1; p=none;",
    });
    expect(r.action).toBe("created");
    expect(calls[1].method).toBe("POST");
  });
});
