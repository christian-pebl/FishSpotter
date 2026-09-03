import { describe, expect, it } from "vitest";
import { FARMS } from "@/lib/farms/catalogue";
import { farmForSite, shortSiteLabel, siteLabel, siteLabelParts } from "@/lib/site-label";

const RAMSEY = "Ramsey Sound, Pembrokeshire, Wales, UK";
const DALE = "Dale Bay, Pembrokeshire, Wales, UK";

describe("siteLabel", () => {
  it("leads with the farm's name for a farm site", () => {
    expect(siteLabel(RAMSEY)).toBe("Câr-y-Môr · Ramsey Sound, Pembrokeshire, Wales, UK");
    expect(siteLabel("Bideford Bay, North Devon, UK")).toBe("Algapelago · Bideford Bay, North Devon, UK");
    expect(siteLabel("Pabay, Inner Sound, Isle of Skye, Scotland, UK")).toBe(
      "Kelp Crofters · Pabay, Inner Sound, Isle of Skye, Scotland, UK",
    );
  });

  it("prints a site that is not a farm exactly as it is", () => {
    expect(siteLabel(DALE)).toBe(DALE);
    expect(siteLabel("Veerse Meer (Lake Veere), Zeeland, Netherlands")).toBe(
      "Veerse Meer (Lake Veere), Zeeland, Netherlands",
    );
  });

  it("matches the exact site string, never a fragment of it", () => {
    // "Ramsey Sound" alone is a deployment-style name, not a site, and a loose
    // match here would label the wrong things.
    expect(siteLabel("Ramsey Sound")).toBe("Ramsey Sound");
    expect(farmForSite("")).toBeNull();
    expect(farmForSite(null)).toBeNull();
  });
});

describe("shortSiteLabel", () => {
  it("keeps the farm and the recognisable leading segment of the place", () => {
    expect(shortSiteLabel(RAMSEY)).toBe("Câr-y-Môr · Ramsey Sound");
    expect(shortSiteLabel(DALE)).toBe("Dale Bay");
    expect(shortSiteLabel("Loch Sunart")).toBe("Loch Sunart");
    expect(shortSiteLabel("")).toBe("");
  });
});

describe("siteLabelParts", () => {
  it("separates the farm from the place for surfaces that style them apart", () => {
    expect(siteLabelParts(RAMSEY)).toEqual({ farm: "Câr-y-Môr", place: RAMSEY });
    expect(siteLabelParts(DALE)).toEqual({ farm: null, place: DALE });
  });
});

describe("the farm catalogue's siteNames", () => {
  it("names a site for every farm that has monitoring clips, and none for a farm without", () => {
    for (const [slug, farm] of Object.entries(FARMS)) {
      if (farm.deploymentNames.length > 0) {
        expect(farm.siteNames.length, `${slug} has deployments but no siteNames`).toBeGreaterThan(0);
      } else {
        expect(farm.siteNames, `${slug} has no deployments yet names a site`).toEqual([]);
      }
    }
  });

  it("files each site under one farm only, so a label can never be ambiguous", () => {
    const seen = new Map<string, string>();
    for (const [slug, farm] of Object.entries(FARMS)) {
      for (const site of farm.siteNames) {
        expect(seen.get(site), `${site} is claimed by ${seen.get(site)} and ${slug}`).toBeUndefined();
        seen.set(site, slug);
      }
    }
  });
});
