import { describe, expect, it } from "vitest";
import {
  archiveFilterQuery,
  archiveOrderBy,
  parseArchiveSearch,
  rotateToClip,
} from "@/lib/archive-query";

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

describe("archiveFilterQuery", () => {
  it("carries the filters the feed has to keep honouring", () => {
    const qs = archiveFilterQuery({ site: "Ramsey Sound", q: "goby", sort: "oldest" });
    expect(new URLSearchParams(qs).get("site")).toBe("Ramsey Sound");
    expect(new URLSearchParams(qs).get("q")).toBe("goby");
    expect(new URLSearchParams(qs).get("sort")).toBe("oldest");
  });

  it("drops page, so the walk continues past the grid's page boundary", () => {
    expect(archiveFilterQuery({ site: "Skye", page: 3 })).toBe("site=Skye");
  });

  it("omits the default sort", () => {
    expect(archiveFilterQuery({ sort: "newest" })).toBe("");
    expect(archiveFilterQuery({})).toBe("");
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
});

describe("parseArchiveSearch", () => {
  it("falls back to the default view on a malformed URL", () => {
    expect(parseArchiveSearch({ sort: "sideways", page: "-4" })).toEqual({});
  });

  it("keeps a valid filter set", () => {
    expect(parseArchiveSearch({ site: "Skye", sort: "site" })).toEqual({
      site: "Skye",
      sort: "site",
    });
  });
});
