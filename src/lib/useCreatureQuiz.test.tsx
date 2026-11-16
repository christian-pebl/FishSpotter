// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The reveal's community panel must survive the moment after it appears.
 *
 * A guest's reveal is filled by POST /api/answers/preview, which grades the
 * guess and returns the community histogram. The hook used to fetch
 * GET /api/snippets/[id]/stats for every card with an answer, guests included,
 * and the route answers a signed-out caller with the gated empty body, so the
 * panel flipped to "0 spotters" on a clip that had answers. (Introduced by the
 * 11 Nov 2026 gating of /stats; found while reviewing PR 207.)
 *
 * The reference's scientific name rides on the same per-user /stats response, so
 * a signed-in spotter must still get it from there.
 */

const sessionMock = vi.hoisted(() => ({
  value: { data: null, status: "unauthenticated" } as {
    data: null | { user: { id: string; isGuest?: boolean } };
    status: string;
  },
}));

vi.mock("next-auth/react", () => ({ useSession: () => sessionMock.value }));
vi.mock("@/lib/confetti", () => ({ triggerCorrectConfetti: vi.fn() }));
vi.mock("@/lib/pebble-bus", () => ({ emitPebbles: vi.fn() }));
vi.mock("@/lib/myAnswers", () => ({
  getMyAnswer: vi.fn(async () => null),
  setMyAnswer: vi.fn(),
}));

import { useCreatureQuiz } from "./useCreatureQuiz";

const SNIPPET = { id: "clip1" };

const PREVIEW = {
  isCorrect: null,
  points: 0,
  total: 7,
  stats: [
    { option: "Ballan wrasse", count: 6, percent: 86 },
    { option: "Crab", count: 1, percent: 14 },
  ],
  staffAnswer: null,
  hasReference: false,
};

const GATED = { gated: true, total: 0, stats: [] };

const SAVED = {
  answer: { chosenOption: "Ballan wrasse", isCorrect: null, points: 5 },
  streak: { current: 1, previous: 0 },
  pebbles: { earned: 5, total: 5, firstSighting: false },
};

const ANSWERED_STATS = {
  total: 7,
  stats: PREVIEW.stats,
  staffAnswer: "Velvet crab",
  staffAnswerScientific: "Necora puber",
  hasReference: true,
};

let calls: string[];

function json(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

/** Answers the endpoints the hook talks to; records each call by path. */
function mockFetch(statsBody: unknown) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/api/answers/preview")) return json(PREVIEW);
      if (url.endsWith("/stats")) return json(statsBody);
      if (url === "/api/answers") return json(SAVED);
      return json({});
    }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
  sessionMock.value = { data: null, status: "unauthenticated" };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useCreatureQuiz: a guest's reveal", () => {
  it("keeps the community panel the preview filled in", async () => {
    mockFetch(GATED);
    const { result } = renderHook(() => useCreatureQuiz(SNIPPET));

    await act(async () => {
      await result.current.handleSubmit({ answerText: "Ballan wrasse" });
    });

    expect(result.current.myAnswer).not.toBeNull();
    expect(result.current.stats?.total).toBe(7);
    expect(result.current.stats?.stats).toEqual(PREVIEW.stats);

    // Give any (wrongly scheduled) follow-up fetch time to land and overwrite.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current.stats?.total).toBe(7);
    expect(result.current.stats?.stats).toEqual(PREVIEW.stats);
  });

  it("never asks /stats, which can only answer a signed-out caller with the gated body", async () => {
    mockFetch(GATED);
    const { result } = renderHook(() => useCreatureQuiz(SNIPPET));
    await act(async () => {
      await result.current.handleSubmit({ answerText: "Ballan wrasse" });
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(calls.some((u) => u.includes("/api/answers/preview"))).toBe(true);
    expect(calls.filter((u) => u.endsWith("/stats"))).toEqual([]);
  });

  it("is refreshed from the saved answer once they sign in", async () => {
    mockFetch(ANSWERED_STATS);
    const { result, rerender } = renderHook(() => useCreatureQuiz(SNIPPET));
    await act(async () => {
      await result.current.handleSubmit({ answerText: "Ballan wrasse" });
    });
    expect(calls.filter((u) => u.endsWith("/stats"))).toEqual([]);

    // The guest signs in on this card: userId appears, and the panel is
    // reloaded from the per-user response.
    sessionMock.value = { data: { user: { id: "u1" } }, status: "authenticated" };
    rerender();
    await waitFor(() => expect(calls.filter((u) => u.endsWith("/stats")).length).toBeGreaterThan(0));
    await waitFor(() => expect(result.current.stats?.staffAnswerScientific).toBe("Necora puber"));
  });
});

describe("useCreatureQuiz: a signed-in spotter's reveal", () => {
  it("loads the panel and the reference's scientific name from /stats after answering", async () => {
    sessionMock.value = { data: { user: { id: "u1" } }, status: "authenticated" };
    mockFetch(ANSWERED_STATS);
    const { result } = renderHook(() => useCreatureQuiz(SNIPPET));

    await act(async () => {
      await result.current.handleSubmit({ answerText: "Ballan wrasse" });
    });

    await waitFor(() => expect(result.current.stats?.staffAnswerScientific).toBe("Necora puber"));
    expect(result.current.stats?.staffAnswer).toBe("Velvet crab");
    expect(result.current.stats?.total).toBe(7);
    expect(calls.filter((u) => u.endsWith("/stats")).length).toBeGreaterThan(0);
  });

  it("still falls back to an empty panel, with no reference, if /stats fails", async () => {
    sessionMock.value = { data: { user: { id: "u1" } }, status: "authenticated" };
    calls = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith("/stats")) return { ok: false, status: 500, json: async () => ({}) } as Response;
        if (url === "/api/answers") return json(SAVED);
        return json({});
      }),
    );
    const { result } = renderHook(() => useCreatureQuiz(SNIPPET));
    await act(async () => {
      await result.current.handleSubmit({ answerText: "Ballan wrasse" });
    });
    await waitFor(() => expect(result.current.stats).not.toBeNull());
    expect(result.current.stats).toEqual({ total: 0, stats: [] });
  });
});
