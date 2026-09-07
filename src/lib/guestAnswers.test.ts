/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  drainGuestAnswers,
  guestAnswerFor,
  pushGuestAnswer,
  readGuestQueue,
  removeGuestAnswer,
} from "./guestAnswers";
import { getMyAnswer } from "./myAnswers";

const ok = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

const answerFor = (snippetId: string, points = 5) => ({
  answer: { snippetId, chosenOption: "Pollack", isCorrect: null, points },
  pebbles: { earned: points, total: 100, firstSighting: false },
});

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the queue", () => {
  it("keeps one guess per snippet, newest wins", () => {
    pushGuestAnswer("a", "Cod");
    pushGuestAnswer("a", "Pollack");
    pushGuestAnswer("b", "Crab");
    expect(readGuestQueue().map((e) => [e.snippetId, e.chosenOption])).toEqual([
      ["a", "Pollack"],
      ["b", "Crab"],
    ]);
    expect(guestAnswerFor("a")?.chosenOption).toBe("Pollack");
    removeGuestAnswer("a");
    expect(guestAnswerFor("a")).toBeNull();
  });
});

describe("drainGuestAnswers", () => {
  it("posts the guesses whose cards are not mounted, and leaves the mounted ones to their cards", async () => {
    // The feed mounts a window of cards; a guess made on a card that has since
    // scrolled out of it has no card to carry it in. Before windowing every
    // card mounted, so this path did not exist and did not need to.
    pushGuestAnswer("near", "Pollack");
    pushGuestAnswer("far", "Cod");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      return ok(answerFor(body.snippetId));
    });

    const posted = await drainGuestAnswers("user-1", new Set(["near"]));

    expect(posted).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      snippetId: "far",
      chosenOption: "Cod",
    });
    // The mounted card's entry is still there for that card to drain.
    expect(readGuestQueue().map((e) => e.snippetId)).toEqual(["near"]);
    // And the shared answer cache already knows, so the far card shows its
    // reveal when the viewer scrolls back to it rather than the quiz again.
    await expect(getMyAnswer("user-1", "far")).resolves.toMatchObject({ chosenOption: "Pollack" });
  });

  it("takes an entry out of the queue BEFORE posting it, so nothing can post it twice", async () => {
    pushGuestAnswer("a", "Cod");
    let queueDuringPost: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      queueDuringPost = readGuestQueue().map((e) => e.snippetId);
      return ok(answerFor("a"));
    });
    await drainGuestAnswers("user-1");
    expect(queueDuringPost).toEqual([]);
    expect(readGuestQueue()).toEqual([]);
  });

  it("puts a guess back when the network or the server fails, and drops one the server rejects", async () => {
    pushGuestAnswer("flaky", "Cod");
    pushGuestAnswer("bad", "Cod");
    pushGuestAnswer("down", "Cod");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const { snippetId } = JSON.parse(String(init?.body));
      if (snippetId === "flaky") throw new TypeError("Failed to fetch");
      if (snippetId === "bad") return ok({ error: "unknown snippet" }, 400);
      return ok({ error: "oops" }, 503);
    });
    const posted = await drainGuestAnswers("user-1");
    expect(posted).toBe(0);
    expect(readGuestQueue().map((e) => e.snippetId).sort()).toEqual(["down", "flaky"]);
  });

  it("does nothing, and fetches nothing, on an empty queue", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(drainGuestAnswers("user-1")).resolves.toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
