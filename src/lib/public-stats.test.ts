import { describe, expect, it } from "vitest";
import { FARMS } from "@/lib/farms/catalogue";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { buildPublicStats, PUBLIC_STATS_DEFINITIONS } from "./public-stats";

const RAMSEY = "Ramsey Sound, Pembrokeshire, Wales, UK"; // Câr-y-Môr
const BIDEFORD = "Bideford Bay, North Devon, UK"; // Algapelago
const PABAY = "Pabay, Inner Sound, Isle of Skye, Scotland, UK"; // Kelp Crofters
const SUNART = "Loch Sunart, Western Highlands, UK"; // Atlantic Mariculture
const DALE = "Dale Bay, Pembrokeshire, Wales, UK"; // a shore site, not a farm

const base = { clips: 10, identifications: 20, spotters: 3, now: new Date("2026-09-07T10:00:00Z") };

describe("buildPublicStats", () => {
  it("uses real catalogue sites as fixtures, so a rename fails here rather than in production", () => {
    const known = Object.values(FARMS).flatMap((farm) => farm.siteNames);
    for (const site of [RAMSEY, BIDEFORD, PABAY, SUNART]) expect(known).toContain(site);
    expect(known).not.toContain(DALE);
  });

  it("passes the counted figures through and stamps the time it was built", () => {
    const stats = buildPublicStats({ ...base, sites: [] });
    expect(stats.clips).toBe(10);
    expect(stats.identifications).toBe(20);
    expect(stats.spotters).toBe(3);
    expect(stats.generatedAt).toBe("2026-09-07T10:00:00.000Z");
  });

  it("counts species as the size of the guide, independent of the clips", () => {
    const stats = buildPublicStats({ ...base, sites: [] });
    expect(stats.species).toBe(Object.keys(CATALOGUE).length);
  });

  it("rolls sites up to farms, counting a farm once and a shore site as a site only", () => {
    const stats = buildPublicStats({ ...base, sites: [RAMSEY, RAMSEY, DALE] });
    expect(stats.sites).toBe(2);
    expect(stats.farmsWithClips).toBe(1);
    expect(stats.farmNames).toEqual(["Câr-y-Môr"]);
    expect(stats.countries).toEqual(["Wales"]);
  });

  it("lists countries without repeats, in catalogue order", () => {
    const stats = buildPublicStats({ ...base, sites: [SUNART, PABAY, RAMSEY, BIDEFORD] });
    expect(stats.farmsWithClips).toBe(4);
    expect(stats.countries).toEqual(["England", "Scotland", "Wales"]);
    expect(stats.farmNames).toEqual(["Algapelago", "Atlantic Mariculture", "Kelp Crofters", "Câr-y-Môr"]);
  });

  it("reports the monitored farm count from the catalogue even when nothing has clips", () => {
    const stats = buildPublicStats({ ...base, sites: [""] });
    expect(stats.sites).toBe(0);
    expect(stats.farmsWithClips).toBe(0);
    expect(stats.farmsMonitored).toBe(Object.keys(FARMS).length);
  });

  it("ships a definition for every figure it publishes", () => {
    const stats = buildPublicStats({ ...base, sites: [RAMSEY] });
    const published = Object.keys(stats).filter((key) => key !== "generatedAt" && key !== "definitions");
    for (const key of published) expect(PUBLIC_STATS_DEFINITIONS[key], key).toBeTruthy();
    expect(stats.definitions).toBe(PUBLIC_STATS_DEFINITIONS);
  });
});
