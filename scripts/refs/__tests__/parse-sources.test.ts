import { describe, expect, it } from "vitest";
import { identityMatch, pageTitle, pageText, mentions } from "../lib/http";
import { fishbaseBlock, marlinParam, parseMarlinSections, quotable } from "../lib/parse-sources";

/**
 * These cover the two places a silent bug would quietly corrupt every citation:
 * deciding whether a page is about a species, and slicing the passage that gets
 * quoted as evidence. Both are pure functions over real page shapes.
 */

describe("identityMatch", () => {
  const marlinMussel =
    "<title>Common mussel (Mytilus edulis) - MarLIN</title><body>Associated species include Pleuronectes platessa and Limanda limanda.</body>";

  it("rejects a page that merely MENTIONS the species in its body", () => {
    // The real defect: MarLIN's mussel page names plaice and dab, so a
    // body-containment test bound two flatfish to a bivalve.
    const r = identityMatch(marlinMussel, {
      binomials: ["Pleuronectes platessa"],
      commonName: "Plaice",
    });
    expect(r.ok).toBe(false);
  });

  it("accepts a page whose title names the binomial", () => {
    const r = identityMatch("<title>Plaice (Pleuronectes platessa) - MarLIN</title><body>x</body>", {
      binomials: ["Pleuronectes platessa"],
      commonName: "Plaice",
    });
    expect(r.ok).toBe(true);
    expect(r.matchedIn).toBe("title");
  });

  it("accepts a synonym in the title, so a renamed species still resolves", () => {
    // MarLIN titles the two-spotted goby under the currently accepted
    // Pomatoschistus flavescens, not the catalogue's older Gobiusculus.
    const r = identityMatch("<title>Two spotted goby (Pomatoschistus flavescens) - MarLIN</title>", {
      binomials: ["Gobiusculus flavescens", "Pomatoschistus flavescens"],
      commonName: "Two-spotted goby",
    });
    expect(r.ok).toBe(true);
    expect(r.matchedOn).toBe("Pomatoschistus flavescens");
  });

  it("accepts a vernacular title when the body carries the binomial (the BTO shape)", () => {
    const r = identityMatch("<title>Shag | BTO</title><body>Gulosus aristotelis breeds on...</body>", {
      binomials: ["Gulosus aristotelis"],
      commonName: "shag",
    });
    expect(r.ok).toBe(true);
    expect(r.matchedIn).toBe("title+body");
  });

  it("rejects a vernacular title whose body never names the binomial", () => {
    const r = identityMatch("<title>Shag | BTO</title><body>nothing useful</body>", {
      binomials: ["Gulosus aristotelis"],
      commonName: "shag",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects a page with no title at all", () => {
    expect(identityMatch("<body>Gadus morhua</body>", { binomials: ["Gadus morhua"] }).ok).toBe(false);
  });
});

describe("pageTitle / pageText / mentions", () => {
  it("reads a multi-line title and collapses its whitespace", () => {
    expect(pageTitle("<title>\n\t Pollack (Pollachius pollachius) \n</title>")).toBe(
      "Pollack (Pollachius pollachius)",
    );
  });

  it("strips scripts and styles rather than searching their contents", () => {
    const text = pageText("<style>.a{}</style><script>var Gadus='morhua'</script><p>Hello</p>");
    expect(text).toBe("Hello");
  });

  it("matches case- and whitespace-insensitively", () => {
    expect(mentions("The  GADUS   MORHUA here", "Gadus morhua")).toBe(true);
    expect(mentions("Gadus", "Gadus morhua")).toBe(false);
  });
});

describe("parseMarlinSections", () => {
  const html = `
    <h2>Description</h2><p>Mature Gadus morhua grow to approximately 120 cm.</p>
    <h2>Identifying features</h2><p>Long chin barbel. Curved, pale lateral line.</p>
    <h3>Description</h3><p>A repeated heading further down the page.</p>`;

  it("indexes sections by lowercased heading", () => {
    const s = parseMarlinSections(html);
    expect(s.get("identifying features")).toContain("Long chin barbel");
  });

  it("keeps the FIRST occurrence, since MarLIN repeats headings in its lower tables", () => {
    const s = parseMarlinSections(html);
    expect(s.get("description")).toContain("120 cm");
    expect(s.get("description")).not.toContain("repeated heading");
  });
});

describe("marlinParam", () => {
  // MarLIN renders these sections as a flat run of label/value pairs.
  const biology =
    "Parameter Data Typical abundance Moderate density Characteristic feeding method Active predator Typically feeds on Sociability Solitary Environmental position Demersal";

  it("pulls a value and stops at the next known label", () => {
    expect(marlinParam(biology, "Characteristic feeding method")).toBe("Active predator");
    expect(marlinParam(biology, "Sociability")).toBe("Solitary");
  });

  it("returns null for an EMPTY field rather than swallowing the next parameter", () => {
    // "Typically feeds on" has no value here; naively slicing to the end would
    // have reported "Sociability Solitary ..." as the diet, inventing evidence.
    expect(marlinParam(biology, "Typically feeds on")).toBeNull();
  });

  it("returns null for a label the section does not contain", () => {
    expect(marlinParam(biology, "Growth rate")).toBeNull();
  });
});

describe("fishbaseBlock", () => {
  const text =
    "Short description Lower jaw distinctly projecting. Lacks a chin barbel (Ref. 1371 ). Biology Found in inshore waters (Refs. 42 , 89 ). Main reference Cohen, D.M. 1990.";

  it("slices a block and stops at the next known label", () => {
    expect(fishbaseBlock(text, "Short description")).toBe(
      "Lower jaw distinctly projecting. Lacks a chin barbel.",
    );
  });

  it("strips FishBase's inline (Ref. N) stubs so quotes stay readable", () => {
    expect(fishbaseBlock(text, "Biology")).toBe("Found in inshore waters.");
  });

  it("returns null when the label is absent", () => {
    expect(fishbaseBlock(text, "Resilience")).toBeNull();
  });
});

describe("quotable", () => {
  it("leaves a short passage untouched", () => {
    expect(quotable("Long chin barbel.")).toBe("Long chin barbel.");
  });

  it("truncates on a word boundary and marks the elision", () => {
    const q = quotable("word ".repeat(80), 40);
    expect(q.endsWith("...")).toBe(true);
    expect(q.length).toBeLessThanOrEqual(44);
    expect(q).not.toMatch(/wor\.\.\.$/);
  });
});
