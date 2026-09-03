import { describe, expect, it } from "vitest";
import { archiveUrl, clipUrl, feedUrlForFilter, snippetFilterParams } from "@/lib/archive-url";

describe("archiveUrl", () => {
  it("is the bare archive for no selection and the default view", () => {
    expect(archiveUrl({})).toBe("/feed/browse");
    expect(archiveUrl({}, { sort: "newest", page: 1 })).toBe("/feed/browse");
  });

  it("writes only the params that are set, in a fixed order", () => {
    expect(archiveUrl({ site: "Dale Bay, Pembrokeshire, Wales, UK" })).toBe(
      "/feed/browse?site=Dale+Bay%2C+Pembrokeshire%2C+Wales%2C+UK",
    );
    expect(archiveUrl({ site: "Skye", species: "cancer-pagurus", q: "Kelp Crofters" })).toBe(
      "/feed/browse?species=cancer-pagurus&site=Skye&q=Kelp+Crofters",
    );
  });

  it("never writes an empty param, which is what a GET form submits for an untouched control", () => {
    for (const url of [
      archiveUrl({ site: "", species: "", q: "" }),
      feedUrlForFilter({ site: "" }),
      clipUrl("abc", { species: "" }),
    ]) {
      expect(url).not.toMatch(/=(&|$)/);
      expect(url).not.toContain("?");
    }
  });

  it("carries a non-default sort and a page past the first", () => {
    expect(archiveUrl({ site: "Skye" }, { sort: "oldest", page: 3 })).toBe(
      "/feed/browse?site=Skye&sort=oldest&page=3",
    );
  });

  it("gives the same selection the same address whichever way it was built", () => {
    const a = archiveUrl({ site: "Skye", species: "cancer-pagurus" });
    const b = archiveUrl({ species: "cancer-pagurus", site: "Skye" });
    expect(a).toBe(b);
  });
});

describe("feedUrlForFilter", () => {
  it("is the bare feed when nothing is filtered", () => {
    expect(feedUrlForFilter({})).toBe("/feed");
  });

  it("carries every active filter across to the feed", () => {
    const url = feedUrlForFilter({ species: "pagurus-bernhardus", site: "Ramsey Sound Farm" });
    expect(url).toBe("/feed?species=pagurus-bernhardus&site=Ramsey+Sound+Farm");
  });
});

describe("clipUrl", () => {
  it("carries the filter and a non-default sort, never a page", () => {
    expect(clipUrl("c1", {})).toBe("/feed/c1");
    expect(clipUrl("c1", { site: "Skye" }, "newest")).toBe("/feed/c1?site=Skye");
    expect(clipUrl("c1", { site: "Skye" }, "site")).toBe("/feed/c1?site=Skye&sort=site");
  });
});

describe("snippetFilterParams", () => {
  it("round-trips through URLSearchParams unchanged", () => {
    const qs = snippetFilterParams({ site: "Loch Sunart, Western Highlands, UK", q: "Atlantic" });
    const back = new URLSearchParams(qs.toString());
    expect(back.get("site")).toBe("Loch Sunart, Western Highlands, UK");
    expect(back.get("q")).toBe("Atlantic");
    expect(back.has("species")).toBe(false);
  });
});
