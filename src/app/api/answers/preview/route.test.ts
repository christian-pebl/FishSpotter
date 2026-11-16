// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A guest's preview reveal must not carry the clip's reference identification.
 *
 * `staffAnswer` is a label for the clip. Until 13 Nov 2026 it reached the
 * browser in the feed's page props before any guess; it now goes only to a
 * signed-in spotter whose answer is saved (GET /api/snippets/[id]/stats). This
 * endpoint needs no proof the clip was watched (anyone can POST any guess), so
 * it must never be a second way to read the label.
 */

const prismaMock = vi.hoisted(() => ({
  snippet: { findUnique: vi.fn() },
  answer: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/csrf", () => ({ assertSameOrigin: vi.fn(() => true) }));
vi.mock("@/lib/rate-limit", () => ({ checkPreviewRateLimit: vi.fn(async () => true) }));

import { POST } from "./route";

const SNIPPET_ID = "clip1";
const REFERENCE = "Velvet crab";

function post(body: unknown = { snippetId: SNIPPET_ID, chosenOption: "Crab" }) {
  return POST(
    new Request("https://www.fishspotter.app/api/answers/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/answers/preview", () => {
  beforeEach(() => {
    // The database holds a reference for this clip. The route must not ask for
    // it, and certainly must not send it.
    prismaMock.snippet.findUnique.mockImplementation(
      async ({ select }: { select: Record<string, boolean> }) => {
        const row: Record<string, unknown> = { id: SNIPPET_ID, staffAnswer: REFERENCE };
        return Object.fromEntries(Object.keys(select).map((k) => [k, row[k]]));
      },
    );
    prismaMock.answer.findMany.mockResolvedValue([
      { chosenOption: "Crab", isCorrect: null },
      { chosenOption: "Crab", isCorrect: null },
      { chosenOption: "Lobster", isCorrect: null },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the community reveal to a guest, with no reference identification", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    const text = await res.text();
    const body = JSON.parse(text);

    expect(body.total).toBe(3);
    expect(body.stats[0]).toMatchObject({ option: "Crab", count: 2 });
    expect(body.staffAnswer).toBeNull();
    expect(body.hasReference).toBe(false);
    expect(text).not.toContain(REFERENCE);
  });

  it("does not even read the reference identification from the database", async () => {
    await post();
    const arg = prismaMock.snippet.findUnique.mock.calls[0][0] as {
      select: Record<string, boolean>;
    };
    expect(arg.select).not.toHaveProperty("staffAnswer");
  });

  it("answers 404 for a clip that does not exist", async () => {
    prismaMock.snippet.findUnique.mockResolvedValue(null);
    const res = await post({ snippetId: "nope", chosenOption: "Crab" });
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain(REFERENCE);
  });
});
