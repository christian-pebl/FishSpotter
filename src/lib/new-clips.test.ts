import { describe, expect, it } from "vitest";
import {
  collectSiteNames,
  describeSites,
  newClipBaseline,
  pluraliseClips,
  shortSiteName,
} from "@/lib/new-clips";

describe("newClipBaseline", () => {
  const createdAt = new Date("2026-07-01T00:00:00Z");

  it("uses the feed-seen stamp when present", () => {
    const lastFeedSeenAt = new Date("2026-08-01T00:00:00Z");
    expect(newClipBaseline({ lastFeedSeenAt, createdAt })).toEqual(lastFeedSeenAt);
  });

  it("falls back to account creation so pre-existing users see no backlog", () => {
    expect(newClipBaseline({ lastFeedSeenAt: null, createdAt })).toEqual(createdAt);
  });

  it("treats an absent field the same as null", () => {
    expect(newClipBaseline({ createdAt })).toEqual(createdAt);
  });
});

describe("describeSites", () => {
  it("is empty for no sites", () => {
    expect(describeSites([])).toBe("");
  });

  it("names a single site bare", () => {
    expect(describeSites(["Loch Sunart"])).toBe("Loch Sunart");
  });

  it("joins two sites with 'and'", () => {
    expect(describeSites(["Loch Sunart", "Bideford Bay"])).toBe(
      "Loch Sunart and Bideford Bay",
    );
  });

  it("joins three sites with a comma then 'and'", () => {
    expect(describeSites(["A", "B", "C"])).toBe("A, B and C");
  });

  it("collapses the tail past the cap", () => {
    expect(describeSites(["A", "B", "C", "D", "E"])).toBe("A, B, C and 2 more");
  });

  it("honours a custom cap", () => {
    expect(describeSites(["A", "B", "C"], 1)).toBe("A and 2 more");
  });
});

describe("shortSiteName", () => {
  it("keeps only the place name from a full location string", () => {
    expect(shortSiteName("Bideford Bay, North Devon, UK")).toBe("Bideford Bay");
    expect(shortSiteName("Pabay, Inner Sound, Isle of Skye, Scotland, UK")).toBe(
      "Pabay",
    );
  });

  it("passes through a site that is already just a place", () => {
    expect(shortSiteName("Loch Sunart")).toBe("Loch Sunart");
  });

  it("is empty for empty input", () => {
    expect(shortSiteName("")).toBe("");
    expect(shortSiteName("   ")).toBe("");
  });
});

describe("collectSiteNames", () => {
  it("dedupes on the place name, not the full string", () => {
    expect(
      collectSiteNames([
        { site: "Bideford Bay, North Devon, UK" },
        { site: "Bideford Bay, Devon" },
        { site: "Loch Sunart, Western Highlands, UK" },
      ]),
    ).toEqual(["Bideford Bay", "Loch Sunart"]);
  });

  it("preserves the order given (callers pass newest first)", () => {
    expect(
      collectSiteNames([{ site: "B, x" }, { site: "A, y" }]),
    ).toEqual(["B", "A"]);
  });

  it("skips null and blank sites", () => {
    expect(
      collectSiteNames([{ site: null }, { site: "" }, { site: "A, y" }]),
    ).toEqual(["A"]);
  });

  it("produces a label a reader can parse", () => {
    const names = collectSiteNames([
      { site: "Freshwater West, Pembrokeshire, Wales, UK" },
      { site: "Bideford Bay, North Devon, UK" },
      { site: "Pabay, Inner Sound, Isle of Skye, Scotland, UK" },
      { site: "Loch Sunart, Western Highlands, UK" },
    ]);
    expect(describeSites(names)).toBe(
      "Freshwater West, Bideford Bay, Pabay and 1 more",
    );
  });
});

describe("pluraliseClips", () => {
  it("is singular at one", () => {
    expect(pluraliseClips(1)).toBe("1 new clip");
  });

  it("is plural otherwise", () => {
    expect(pluraliseClips(0)).toBe("0 new clips");
    expect(pluraliseClips(12)).toBe("12 new clips");
  });
});
