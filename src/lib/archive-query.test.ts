import { describe, expect, it } from "vitest";
import { archiveOrderBy, parseArchiveSort, rotateToClip } from "@/lib/archive-query";

const rows = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

describe("rotateToClip", () => {
  it("starts the walk at the tapped clip", () => {
    expect(rotateToClip(rows, "c")).toEqual([{ id: "c" }, { id: "d" }, { id: "a" }, { id: "b" }]);
  });

  it("leaves a list already starting at the clip untouched", () => {
    expect(rotateToClip(rows, "a")).toBe(rows);
  });

  it("wraps past the end rather than dead-ending on the last clip", () => {
    // The whole point: a clip at the bottom of the archive still has a next.
    const rotated = rotateToClip(rows, "d");
    expect(rotated).toHaveLength(rows.length);
    expect(rotated?.[0]).toEqual({ id: "d" });
    expect(rotated?.[1]).toEqual({ id: "a" });
  });

  it("keeps every clip exactly once", () => {
    const rotated = rotateToClip(rows, "b") ?? [];
    expect(new Set(rotated.map((r) => r.id)).size).toBe(rows.length);
  });

  it("returns null for a clip the filter or the blocklist removed", () => {
    expect(rotateToClip(rows, "missing")).toBeNull();
    expect(rotateToClip([], "a")).toBeNull();
  });
});

describe("archiveOrderBy", () => {
  it("tie-breaks on id so the grid and the feed agree inside a bucket", () => {
    for (const sort of ["newest", "oldest", "site", undefined] as const) {
      const order = archiveOrderBy(sort);
      expect(order[order.length - 1]).toEqual({ id: "asc" });
    }
  });

  it("falls back to newest-first for an unknown sort", () => {
    expect(archiveOrderBy(undefined)).toEqual(archiveOrderBy("newest"));
  });

  it("sorts oldest-first only when asked", () => {
    expect(archiveOrderBy("oldest")[0]).toEqual({ createdAt: "asc" });
    expect(archiveOrderBy("newest")[0]).toEqual({ createdAt: "desc" });
  });
});

describe("parseArchiveSort", () => {
  it("falls back to the default view on a malformed URL", () => {
    expect(parseArchiveSort({ sort: "sideways", page: "-4" })).toEqual({});
  });

  it("keeps a valid sort and page", () => {
    expect(parseArchiveSort({ sort: "site", page: "3" })).toEqual({ sort: "site", page: 3 });
  });

  it("ignores the filter params, which snippet-filter owns", () => {
    expect(parseArchiveSort({ species: "hermit-crab", site: "Skye" })).toEqual({});
  });
});
