import { describe, expect, it } from "vitest";
import { VercelClient } from "../vercel-env";

interface MockCall {
  url: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
}

function makeMockFetch(handlers: Array<(req: MockCall) => Response | Promise<Response>>) {
  const calls: MockCall[] = [];
  const fetchImpl: typeof fetch = (async (input, init) => {
    const url = typeof input === "string" ? input : (input as URL).toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const bodyText = typeof init?.body === "string" ? init.body : "";
    const body = bodyText ? JSON.parse(bodyText) : null;
    const call: MockCall = {
      url,
      method,
      body,
      headers: (init?.headers ?? {}) as Record<string, string>,
    };
    calls.push(call);
    const handler = handlers[calls.length - 1];
    if (!handler) throw new Error(`No mock handler for call #${calls.length}: ${method} ${url}`);
    return handler(call);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function jsonRes(status: number, body: unknown): Response {
  // Per the Fetch spec, null-body statuses (204/205/304) must not have
  // a body — synthesise empty responses for those.
  if (status === 204 || status === 205 || status === 304) {
    return new Response(null, { status });
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("VercelClient.upsert", () => {
  it("creates a fresh env var when one doesn't exist", async () => {
    const { fetchImpl, calls } = makeMockFetch([
      // listEnv
      () => jsonRes(200, { envs: [] }),
      // POST create
      () => jsonRes(200, {}),
    ]);
    const client = new VercelClient({
      token: "tok",
      projectId: "prj_test",
      fetchImpl,
    });
    const result = await client.upsert({ key: "TEST_KEY", value: "v1" });
    expect(result.action).toBe("created");
    expect(calls[1].method).toBe("POST");
    expect(calls[1].url).toContain("/v10/projects/prj_test/env");
    expect(calls[1].body).toMatchObject({
      key: "TEST_KEY",
      value: "v1",
      target: ["production", "preview"],
      type: "encrypted",
    });
  });

  it("deletes-then-recreates when the env var already exists", async () => {
    const { fetchImpl, calls } = makeMockFetch([
      () =>
        jsonRes(200, {
          envs: [{ id: "env_abc", key: "TEST_KEY", type: "encrypted", target: ["production"] }],
        }),
      () => jsonRes(204, {}),
      () => jsonRes(200, {}),
    ]);
    const client = new VercelClient({
      token: "tok",
      projectId: "prj_test",
      fetchImpl,
    });
    const result = await client.upsert({ key: "TEST_KEY", value: "v2" });
    expect(result.action).toBe("updated");
    expect(calls[1].method).toBe("DELETE");
    expect(calls[1].url).toContain("/env/env_abc");
    expect(calls[2].method).toBe("POST");
  });

  it("includes teamId as a query string when provided", async () => {
    const { fetchImpl, calls } = makeMockFetch([
      () => jsonRes(200, { envs: [] }),
      () => jsonRes(200, {}),
    ]);
    const client = new VercelClient({
      token: "tok",
      projectId: "prj_test",
      teamId: "team_42",
      fetchImpl,
    });
    await client.upsert({ key: "K", value: "v" });
    expect(calls[0].url).toContain("teamId=team_42");
  });

  it("propagates Vercel API errors", async () => {
    const { fetchImpl } = makeMockFetch([
      () =>
        new Response('{"error":"bad token"}', {
          status: 403,
          statusText: "Forbidden",
          headers: { "content-type": "application/json" },
        }),
    ]);
    const client = new VercelClient({
      token: "bad",
      projectId: "prj",
      fetchImpl,
    });
    await expect(client.upsert({ key: "X", value: "y" })).rejects.toThrow(/403/);
  });

  it("respects custom targets", async () => {
    const { fetchImpl, calls } = makeMockFetch([
      () => jsonRes(200, { envs: [] }),
      () => jsonRes(200, {}),
    ]);
    const client = new VercelClient({
      token: "tok",
      projectId: "prj",
      fetchImpl,
    });
    await client.upsert({
      key: "K",
      value: "v",
      targets: ["production"],
      type: "plain",
    });
    expect(calls[1].body).toMatchObject({
      target: ["production"],
      type: "plain",
    });
  });
});
