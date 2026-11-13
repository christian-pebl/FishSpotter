// @vitest-environment node
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectTypeOf } from "vitest";
import type { FeedSnippet } from "@/components/FeedPlayer";

/**
 * The feed ships NO clip's reference identification (`staffAnswer`) before the
 * spotter has answered it. Measured on production on 12 Nov 2026: one signed-out
 * /feed page load carried 77 of them in its payload. They are labels, and the
 * crowd is the authority, so the reveal now gets the reference from
 * GET /api/snippets/[id]/stats only after an answer is saved.
 *
 * The page is called as a function with the database mocked to return only the
 * columns the query selects, then the props it hands to FeedPlayer are checked.
 * That fails if `staffAnswer` is selected or passed on again.
 */

const REFERENCE = "Velvet crab";

const prismaMock = vi.hoisted(() => ({
  snippet: { findMany: vi.fn() },
  answer: { findMany: vi.fn() },
  user: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => null) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined })),
  headers: vi.fn(async () => ({ get: () => "Mozilla/5.0 (iPhone)" })),
}));
// Client components are stubbed: only the props the page hands them matter.
vi.mock("@/components/FeedPlayer", () => ({ FeedPlayer: () => null }));
vi.mock("@/components/onboarding/OnboardingTour", () => ({ OnboardingTour: () => null }));
vi.mock("@/components/VerificationBanner", () => ({ VerificationBanner: () => null }));
vi.mock("@/components/guest/GuestGate", () => ({ GuestGate: () => null }));
vi.mock("@/components/guest/GuestSavePrompt", () => ({ GuestSavePrompt: () => null }));
vi.mock("@/components/FeedFilterNotice", () => ({ FeedFilterNotice: () => null }));

import { FeedPlayer } from "@/components/FeedPlayer";
import FeedPage from "./page";

const DB_ROWS = Array.from({ length: 6 }, (_, i) => ({
  id: `clip${i}`,
  externalId: `folder-${i}`,
  videoUrl: `https://media.example/clip${i}.mp4`,
  videoUrlSd: null,
  thumbnailUrl: `https://media.example/clip${i}.jpg`,
  site: "SITE",
  deployment: "D1",
  staffAnswer: REFERENCE,
  lat: 51.5,
  lon: -3.1,
  depthM: 4,
  recordingDatetime: "2026-08-01T10:00:00Z",
  difficultyScore: 0.3,
  bboxJson: null,
  manualTrackJson: null,
}));

/** Returns only the selected columns, as the database would. */
function selected(select: Record<string, boolean>) {
  return DB_ROWS.map((row) =>
    Object.fromEntries(Object.keys(select).map((k) => [k, (row as Record<string, unknown>)[k]])),
  );
}

/** Finds the first element of `type` anywhere under `node`. */
function findElement(node: ReactNode, type: unknown): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findElement(child, type);
      if (hit) return hit;
    }
    return null;
  }
  if (node && typeof node === "object" && "props" in node) {
    const el = node as ReactElement<{ children?: ReactNode }>;
    if (el.type === type) return el;
    return findElement(el.props.children, type);
  }
  return null;
}

describe("/feed page", () => {
  beforeEach(() => {
    prismaMock.snippet.findMany.mockImplementation(
      async ({ select }: { select: Record<string, boolean> }) => selected(select),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("selects no reference identification from the database", async () => {
    await FeedPage({ searchParams: Promise.resolve({}) });
    expect(prismaMock.snippet.findMany).toHaveBeenCalled();
    for (const [arg] of prismaMock.snippet.findMany.mock.calls) {
      expect((arg as { select: Record<string, boolean> }).select).not.toHaveProperty(
        "staffAnswer",
      );
    }
  });

  it("hands FeedPlayer snippets with no reference identification", async () => {
    const tree = await FeedPage({ searchParams: Promise.resolve({}) });
    const player = findElement(tree, FeedPlayer);
    expect(player).not.toBeNull();

    const snippets = (player!.props as { snippets: Array<Record<string, unknown>> }).snippets;
    expect(snippets).toHaveLength(DB_ROWS.length);
    for (const snippet of snippets) {
      expect(snippet).not.toHaveProperty("staffAnswer");
      expect(typeof snippet.id).toBe("string");
      expect(typeof snippet.videoUrl).toBe("string");
    }

    // Everything the page puts in front of the client, serialised: this is the
    // payload that carried 77 labels before the fix.
    const payload = JSON.stringify(tree);
    expect(payload).not.toContain("staffAnswer");
    expect(payload).not.toContain(REFERENCE);
  });

  it("types FeedSnippet without a reference identification", () => {
    expectTypeOf<FeedSnippet>().not.toHaveProperty("staffAnswer");
  });
});
