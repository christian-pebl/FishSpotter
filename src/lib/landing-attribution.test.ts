// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  captureLandingAttribution,
  landingAttribution,
  parseAttribution,
  resetLandingAttributionForTests,
} from "./landing-attribution";

describe("parseAttribution", () => {
  it("reads the three UTM tags and the referrer hostname", () => {
    expect(
      parseAttribution(
        "?utm_source=flyer&utm_medium=print&utm_campaign=seaweed-festival-2026",
        "https://www.facebook.com/groups/123?ref=share",
      ),
    ).toEqual({
      utmSource: "flyer",
      utmMedium: "print",
      utmCampaign: "seaweed-festival-2026",
      referrer: "facebook.com",
    });
  });

  it("keeps only the hostname of a referrer, never its path or query", () => {
    expect(parseAttribution("", "https://scistarter.org/fishspotter?user=42").referrer).toBe("scistarter.org");
  });

  it("returns nothing for a direct visit", () => {
    expect(parseAttribution("", "")).toEqual({});
  });

  it("drops empty tags and truncates long ones", () => {
    const long = "x".repeat(300);
    const out = parseAttribution(`?utm_source=&utm_campaign=${long}`, "");
    expect(out.utmSource).toBeUndefined();
    expect(out.utmCampaign).toHaveLength(128);
  });

  it("ignores an unparseable referrer", () => {
    expect(parseAttribution("?utm_source=qr", "not a url")).toEqual({ utmSource: "qr" });
  });
});

describe("landing attribution across a client-side hop", () => {
  afterEach(() => {
    resetLandingAttributionForTests();
    window.history.replaceState(null, "", "/");
  });

  it("keeps the landing page's tags after the URL loses its query", () => {
    // Land on the home page from a flyer's QR code...
    window.history.replaceState(null, "", "/?utm_source=flyer&utm_campaign=seaweed-festival-2026");
    captureLandingAttribution();
    // ...then "Start spotting" moves to /feed without the query string.
    window.history.pushState(null, "", "/feed");

    expect(landingAttribution()).toEqual({ utmSource: "flyer", utmCampaign: "seaweed-festival-2026" });
  });

  it("lets the first page win over later captures", () => {
    window.history.replaceState(null, "", "/?utm_source=first");
    captureLandingAttribution();
    window.history.pushState(null, "", "/feed?utm_source=second");
    captureLandingAttribution();

    expect(landingAttribution().utmSource).toBe("first");
  });

  it("captures the current page when nothing was recorded on landing", () => {
    // Landing straight on the feed: the tracker can ask before the layout's
    // effect has run, and must still see the tags.
    window.history.replaceState(null, "", "/feed?utm_source=partner");
    expect(landingAttribution().utmSource).toBe("partner");
  });
});
