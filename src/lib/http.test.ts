import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout, isTimeoutError } from "./http";

describe("fetchWithTimeout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes an AbortSignal to fetch and resolves on a fast response", async () => {
    const ok = new Response("ok", { status: 200 });
    const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(init?.signal?.aborted).toBe(false);
      return ok;
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchWithTimeout("https://example.test", {}, 1000);
    expect(res).toBe(ok);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("aborts when the timeout elapses before the response", async () => {
    // fetch that only settles when its signal aborts — emulating a hung upstream.
    const fetchMock = vi.fn((_url: string | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(init.signal!.reason ?? new Error("aborted")),
        );
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchWithTimeout("https://example.test", {}, 10)).rejects.toSatisfy(
      (err: unknown) => isTimeoutError(err),
    );
  });

  it("forwards method, headers and body to fetch", async () => {
    const fetchMock = vi.fn(
      async (_url: string | URL, _init?: RequestInit) => new Response(null, { status: 204 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchWithTimeout(
      "https://example.test",
      { method: "POST", headers: { "x-test": "1" }, body: "hi" },
      1000,
    );

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["x-test"]).toBe("1");
    expect(init?.body).toBe("hi");
  });
});
