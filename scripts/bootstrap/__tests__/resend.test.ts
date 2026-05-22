import { describe, expect, it } from "vitest";
import { ResendClient } from "../resend-domain";

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

describe("ResendClient.ensureDomainAndGetDnsRecords", () => {
  it("creates the domain when it doesn't exist + returns DNS records", async () => {
    const { fetchImpl, calls } = makeMockFetch([
      // list — empty
      () => jsonRes(200, { data: [] }),
      // create
      () => jsonRes(200, { id: "dom_xxx", name: "pebl-cic.co.uk", status: "pending" }),
      // get
      () =>
        jsonRes(200, {
          id: "dom_xxx",
          name: "pebl-cic.co.uk",
          status: "pending",
          records: [
            { type: "TXT", name: "send.pebl-cic.co.uk", value: "v=spf1 include:amazonses.com ~all" },
            {
              type: "TXT",
              name: "resend._domainkey.pebl-cic.co.uk",
              value: "k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ…",
            },
          ],
        }),
    ]);
    const client = new ResendClient({ apiKey: "re_xxx", fetchImpl });
    const records = await client.ensureDomainAndGetDnsRecords("pebl-cic.co.uk");
    expect(calls[1].method).toBe("POST");
    expect(calls[1].body).toEqual({ name: "pebl-cic.co.uk" });
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      type: "TXT",
      name: "send.pebl-cic.co.uk",
      content: "v=spf1 include:amazonses.com ~all",
    });
  });

  it("skips creation when the domain already exists", async () => {
    const { fetchImpl, calls } = makeMockFetch([
      () =>
        jsonRes(200, {
          data: [{ id: "dom_existing", name: "pebl-cic.co.uk", status: "verified" }],
        }),
      () =>
        jsonRes(200, {
          id: "dom_existing",
          name: "pebl-cic.co.uk",
          status: "verified",
          records: [{ type: "TXT", name: "send.pebl-cic.co.uk", value: "v=spf1 ~all" }],
        }),
    ]);
    const client = new ResendClient({ apiKey: "re_xxx", fetchImpl });
    const records = await client.ensureDomainAndGetDnsRecords("pebl-cic.co.uk");
    expect(calls.length).toBe(2); // list + get; no POST
    expect(records).toHaveLength(1);
  });

  it("surfaces Resend API errors", async () => {
    const { fetchImpl } = makeMockFetch([
      () =>
        new Response("invalid key", {
          status: 401,
          statusText: "Unauthorized",
          headers: { "content-type": "text/plain" },
        }),
    ]);
    const client = new ResendClient({ apiKey: "bad", fetchImpl });
    await expect(client.listDomains()).rejects.toThrow(/401/);
  });
});
