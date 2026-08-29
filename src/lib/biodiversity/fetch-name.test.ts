import { describe, it, expect } from "vitest";
import { fetchNameFor } from "@/lib/biodiversity/fetch-name";

describe("fetchNameFor", () => {
  it("passes an ordinary species name straight through", () => {
    expect(fetchNameFor("Gadus morhua")).toBe("Gadus morhua");
  });

  it("pins a group-level catalogue entry to its representative species", () => {
    // Majoidea is a superfamily. iNaturalist has no research-grade
    // observations at that rank, so an unpinned pull returns nothing and the
    // spider crab gallery silently stays empty.
    expect(fetchNameFor("Majoidea")).toBe("Hyas araneus");
  });

  it("passes an unknown name through rather than throwing", () => {
    expect(fetchNameFor("Not a species")).toBe("Not a species");
  });
});
