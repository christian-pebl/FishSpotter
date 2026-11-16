// @vitest-environment node
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The home page's hero is the pinned clip, and reads nothing of it but its site.
 *
 * It used to select `staffAnswer`, `videoUrl` and `thumbnailUrl` of the pinned
 * clip AND of the newest 25 clips, to fall back to "the newest clip whose label
 * names a species" if the pinned one was missing. None of that reached the page
 * (the video and poster are local files and the chips are fixed text), but the
 * fallback would have captioned unrelated footage "Velvet crab" and downloaded a
 * full-size master as the hero, and it read a label column on every render for
 * no purpose. These tests hold the page to what it needs.
 *
 * The page is called as a function with the database mocked to return only the
 * columns each query selects, as Prisma does.
 */

const FULL_ROW = {
  videoUrl: "https://media.example/storage/v1/object/public/snippets/clips/aaaaaaaaaaaaaaaaaaaaaaaa.mp4",
  thumbnailUrl: "https://media.example/storage/v1/object/public/snippets/thumbs/bbbbbbbbbbbbbbbbbbbbbbbb.jpg",
  staffAnswer: "Zz mock reference label",
  site: "Pabay, Isle of Skye, Scotland, UK",
};

const prismaMock = vi.hoisted(() => ({
  snippet: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  answer: { count: vi.fn() },
  speciesImage: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("react-dom", async (importOriginal) => ({ ...(await importOriginal<object>()), preload: vi.fn() }));
// Client components are stubbed: only the props the page hands them matter.
vi.mock("@/components/MarineBackdrop", () => ({ MarineBackdrop: () => null }));
vi.mock("@/components/DeletedAccountToast", () => ({ DeletedAccountToast: () => null }));
vi.mock("@/components/landing/HeroPreview", () => ({ HeroPreview: () => null }));
vi.mock("@/components/landing/StatsBand", () => ({ StatsBand: () => null }));
vi.mock("@/components/landing/StepCards", () => ({ StepCards: () => null }));
vi.mock("@/components/landing/SpeciesMarquee", () => ({ SpeciesMarquee: () => null }));
vi.mock("@/components/DeferredImg", () => ({ DeferredImg: () => null }));

import { preload } from "react-dom";
import { HeroPreview } from "@/components/landing/HeroPreview";
import HomePage from "./page";

/** Returns only the selected columns, as the database would. */
function selected(select: Record<string, boolean> | undefined) {
  if (!select) return { ...FULL_ROW };
  return Object.fromEntries(Object.keys(select).map((k) => [k, (FULL_ROW as Record<string, unknown>)[k]]));
}

/** Everything the page puts in front of the client, serialised. Skips React's own element internals. */
function serialise(tree: unknown): string {
  return JSON.stringify(tree, (key, value) => (key === "type" || key === "_owner" || key === "_store" ? undefined : value));
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

beforeEach(() => {
  prismaMock.snippet.findUnique.mockImplementation(async (args: { select?: Record<string, boolean> }) => selected(args.select));
  prismaMock.snippet.findMany.mockResolvedValue([{ ...FULL_ROW }]);
  prismaMock.snippet.count.mockResolvedValue(139);
  prismaMock.answer.count.mockResolvedValue(1234);
  prismaMock.speciesImage.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("the home page hero", () => {
  it("is the pinned clip, from local files, and reads only that clip's site", async () => {
    const tree = await HomePage();

    const hero = findElement(tree, HeroPreview);
    expect(hero).not.toBeNull();
    const props = hero!.props as { videoUrl: string; poster: string; site: string };
    expect(props.videoUrl).toBe("/hero/velvet-crab-preview.mp4");
    expect(props.poster).toBe("/hero/velvet-crab-preview-3x4.webp");
    expect(props.site.length).toBeGreaterThan(0);

    expect(prismaMock.snippet.findUnique).toHaveBeenCalledTimes(1);
    const arg = prismaMock.snippet.findUnique.mock.calls[0][0];
    expect(arg.where.externalId).toMatch(/velvetcrab/);
    expect(arg.select).toEqual({ site: true });
    expect(preload).toHaveBeenCalledWith("/hero/velvet-crab-preview-3x4.webp", expect.objectContaining({ as: "image" }));
  });

  it("no longer queries the newest clips, so no clip's label or URL is read for the page", async () => {
    await HomePage();
    expect(prismaMock.snippet.findMany).not.toHaveBeenCalled();
  });

  it("puts no clip URL, label or still in front of the client", async () => {
    const payload = serialise(await HomePage());
    expect(payload).not.toContain("staffAnswer");
    expect(payload).not.toContain(FULL_ROW.staffAnswer);
    expect(payload).not.toContain(FULL_ROW.videoUrl);
    expect(payload).not.toContain(FULL_ROW.thumbnailUrl);
  });

  it("leaves the card out, rather than captioning another clip, if the pinned clip is missing", async () => {
    prismaMock.snippet.findUnique.mockResolvedValue(null);
    const tree = await HomePage();
    expect(tree).not.toBeNull();
    expect(findElement(tree, HeroPreview)).toBeNull();
    expect(preload).not.toHaveBeenCalled();
    expect(serialise(tree)).not.toContain(FULL_ROW.videoUrl);
  });
});
