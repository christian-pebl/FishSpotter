// @vitest-environment node
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /feed/[id] opens one clip in the feed and, like /feed, must not ship any
 * clip's reference identification (`staffAnswer`) to the browser before the
 * spotter has answered it. See src/app/feed/page.test.tsx for the measurement.
 *
 * The database mock returns only the columns a query selects, so this fails if
 * `staffAnswer` is selected or passed on again.
 */

const REFERENCE = "Velvet crab";

const prismaMock = vi.hoisted(() => ({
  snippet: { findMany: vi.fn(), findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => null) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: () => "Mozilla/5.0 (iPhone)" })),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/components/FeedPlayer", () => ({ FeedPlayer: () => null }));
vi.mock("@/components/FeedFilterNotice", () => ({ FeedFilterNotice: () => null }));
vi.mock("@/components/VerificationBanner", () => ({ VerificationBanner: () => null }));
vi.mock("@/components/guest/GuestGate", () => ({ GuestGate: () => null }));
vi.mock("@/components/guest/GuestSavePrompt", () => ({ GuestSavePrompt: () => null }));

import { FeedPlayer } from "@/components/FeedPlayer";
import SnippetDetailPage from "./page";

const DB_ROWS = Array.from({ length: 4 }, (_, i) => ({
  id: `clip${i}`,
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
  createdAt: new Date("2026-08-01T10:00:00Z"),
  bboxJson: null,
  manualTrackJson: null,
}));

function selected(select: Record<string, boolean>) {
  return DB_ROWS.map((row) =>
    Object.fromEntries(Object.keys(select).map((k) => [k, (row as Record<string, unknown>)[k]])),
  );
}

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

function render(id = "clip2") {
  return SnippetDetailPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({}),
  });
}

describe("/feed/[id] page", () => {
  beforeEach(() => {
    prismaMock.snippet.findMany.mockImplementation(
      async ({ select }: { select: Record<string, boolean> }) => selected(select),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("selects no reference identification from the database", async () => {
    await render();
    expect(prismaMock.snippet.findMany).toHaveBeenCalled();
    for (const [arg] of prismaMock.snippet.findMany.mock.calls) {
      expect((arg as { select: Record<string, boolean> }).select).not.toHaveProperty(
        "staffAnswer",
      );
    }
  });

  it("hands FeedPlayer snippets with no reference identification, opening on the clip", async () => {
    const tree = await render("clip2");
    const player = findElement(tree, FeedPlayer);
    expect(player).not.toBeNull();

    const snippets = (player!.props as { snippets: Array<Record<string, unknown>> }).snippets;
    expect(snippets).toHaveLength(DB_ROWS.length);
    expect(snippets[0].id).toBe("clip2");
    for (const snippet of snippets) {
      expect(snippet).not.toHaveProperty("staffAnswer");
    }

    const payload = JSON.stringify(tree);
    expect(payload).not.toContain("staffAnswer");
    expect(payload).not.toContain(REFERENCE);
  });
});
