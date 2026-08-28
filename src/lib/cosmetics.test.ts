import { describe, it, expect } from "vitest";
import {
  FRAMES,
  getFrame,
  frameFor,
  FRAME_KELP_CONFIRMED,
  backdropTarget,
  backdropUnlocked,
  BACKDROP_UNLOCK_ANSWERS,
  shortSiteName,
  crestAllowed,
  backdropAllowed,
} from "@/lib/cosmetics";
import {
  BACKDROP_WASHES,
  backdropWash,
  FRAME_STYLES,
  frameStyle,
} from "@/components/profile/cosmetic-styles";
import type { BadgeCounts } from "@/lib/badges";

const NONE: BadgeCounts = {
  confirmed: 0,
  pathfinder: 0,
  current: 0,
  pioneer: 0,
  "deep-pioneer": 0,
};

describe("frameFor", () => {
  it("gives a new spotter no frame", () => {
    expect(frameFor(NONE)).toBe("none");
  });

  it("does not hand out a frame for raw volume alone below the bar", () => {
    expect(frameFor({ ...NONE, confirmed: FRAME_KELP_CONFIRMED - 1 })).toBe("none");
    expect(frameFor({ ...NONE, pathfinder: 100 })).toBe("none");
  });

  it("awards kelp on confirmed volume", () => {
    expect(frameFor({ ...NONE, confirmed: FRAME_KELP_CONFIRMED })).toBe("kelp");
  });

  it("awards coral for a single pioneer call, outranking volume", () => {
    expect(frameFor({ ...NONE, confirmed: 500, pioneer: 1 })).toBe("coral");
  });

  it("awards deep for a deep pioneer call, outranking everything", () => {
    expect(frameFor({ ...NONE, confirmed: 500, pioneer: 50, "deep-pioneer": 1 })).toBe(
      "deep",
    );
  });

  it("reports a high-water mark, so a stronger badge always wins", () => {
    // Whatever combination, the answer is the strongest credential held.
    expect(frameFor({ ...NONE, "deep-pioneer": 1 })).toBe("deep");
    expect(frameFor({ ...NONE, pioneer: 3 })).toBe("coral");
  });
});

describe("getFrame", () => {
  it("falls back to the no-frame default for an unknown id", () => {
    expect(getFrame("nonsense" as never).id).toBe("none");
  });

  it("gives every frame a requirement line except the default", () => {
    for (const f of FRAMES) {
      if (f.id === "none") continue;
      expect(f.requirement.length).toBeGreaterThan(0);
    }
  });
});

describe("backdropTarget", () => {
  it("uses the flat threshold at a well-stocked site", () => {
    expect(backdropTarget(52)).toBe(BACKDROP_UNLOCK_ANSWERS);
  });

  it("never sets a target a site cannot supply", () => {
    // Freshwater West has 1 clip and East Pickard Bay has 4. A flat threshold
    // of 5 would make both permanently unreachable.
    expect(backdropTarget(1)).toBe(1);
    expect(backdropTarget(4)).toBe(4);
  });

  it("stays at least 1 even for an empty site", () => {
    expect(backdropTarget(0)).toBe(1);
  });
});

describe("backdropUnlocked", () => {
  it("unlocks on reaching the target", () => {
    expect(backdropUnlocked(5, 52)).toBe(true);
    expect(backdropUnlocked(4, 52)).toBe(false);
  });

  it("unlocks a one-clip site from that one clip", () => {
    expect(backdropUnlocked(1, 1)).toBe(true);
  });

  it("never unlocks a site with no clips", () => {
    expect(backdropUnlocked(10, 0)).toBe(false);
  });
});

describe("presentation layer (must live under src/components)", () => {
  it("has a style entry for every frame id", () => {
    for (const f of FRAMES) {
      expect(FRAME_STYLES[f.id]).toBeDefined();
    }
  });

  it("gives every frame above the default a visible ring and bar", () => {
    for (const f of FRAMES) {
      if (f.id === "none") continue;
      expect(frameStyle(f.id).ring.length).toBeGreaterThan(0);
      expect(frameStyle(f.id).bar.length).toBeGreaterThan(0);
    }
  });

  it("leaves the default frame with no treatment", () => {
    expect(frameStyle("none").ring).toBe("");
    expect(frameStyle("none").bar).toBe("");
  });
});

describe("backdropWash", () => {
  it("returns nothing when no backdrop is set", () => {
    expect(backdropWash(null)).toBe("");
    expect(backdropWash(undefined)).toBe("");
  });

  it("has a wash for every known site", () => {
    for (const site of Object.keys(BACKDROP_WASHES)) {
      expect(backdropWash(site)).toBe(BACKDROP_WASHES[site]);
    }
  });

  it("degrades a newly-added site to a neutral wash rather than breaking", () => {
    expect(backdropWash("Somewhere New, UK")).not.toBe("");
  });
});

describe("shortSiteName", () => {
  it("keeps just the place", () => {
    expect(shortSiteName("Ramsey Sound, Pembrokeshire, Wales, UK")).toBe(
      "Ramsey Sound",
    );
  });

  it("passes through a site with no comma", () => {
    expect(shortSiteName("Ramsey Sound")).toBe("Ramsey Sound");
  });
});

describe("write guards", () => {
  const unlockedSpecies = new Set(["Pollachius pollachius"]);
  const unlockedSites = new Set(["Ramsey Sound, Pembrokeshire, Wales, UK"]);

  it("allows a crest the spotter has unlocked", () => {
    expect(crestAllowed("Pollachius pollachius", unlockedSpecies)).toBe(true);
  });

  it("rejects a crest the spotter has not unlocked", () => {
    // The whole point of the guard: a crest is a public claim to have found it.
    expect(crestAllowed("Aurelia aurita", unlockedSpecies)).toBe(false);
  });

  it("always allows clearing a choice", () => {
    expect(crestAllowed(null, new Set())).toBe(true);
    expect(backdropAllowed(null, new Set())).toBe(true);
  });

  it("rejects a backdrop for a site the spotter has not worked", () => {
    expect(backdropAllowed("Loch Sunart, Western Highlands, UK", unlockedSites)).toBe(
      false,
    );
    expect(
      backdropAllowed("Ramsey Sound, Pembrokeshire, Wales, UK", unlockedSites),
    ).toBe(true);
  });
});
