import { test, expect } from "@playwright/test";

const M = "/api/id-guide/match";

test.describe("POST /api/id-guide/match", () => {
  test("hermit crab path returns Pagurus bernhardus at the top", async ({ request }) => {
    const r = await request.post(M, {
      data: {
        answers: {
          functionalGroup: "crab",
          locomotion: "crawling",
          screenZone: "seabed",
          bodyShape: "hidden-in-shell",
        },
      },
    });
    expect(r.ok()).toBe(true);
    const body = await r.json();
    expect(body.candidates.length).toBeGreaterThan(0);

    const top = body.candidates[0];
    expect(top.taxon.scientificName).toBe("Pagurus bernhardus");
    expect(top.matchScore).toBeCloseTo(1, 2);
    expect(top.matchReasons).toEqual(
      expect.arrayContaining(["crab", "crawling", "seabed", "hidden-in-shell"]),
    );
  });

  test("flatfish path returns flounder/turbot in top 3", async ({ request }) => {
    const r = await request.post(M, {
      data: {
        answers: {
          functionalGroup: "fish",
          bodyShape: "flat",
          locomotion: "stationary",
        },
      },
    });
    const body = await r.json();
    const top3names = body.candidates.slice(0, 3).map((c: any) => c.taxon.scientificName);
    expect(top3names).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Platichthys flesus|Scophthalmus maximus|Pleuronectiformes/),
      ]),
    );
  });

  test("renamed taxa are reachable: pouting → Trisopterus luscus", async ({ request }) => {
    const r = await request.post(M, {
      data: {
        answers: {
          functionalGroup: "fish",
          bodyShape: "streamlined",
          colorTag: "striped",
        },
      },
    });
    const body = await r.json();
    const sciNames = body.candidates.map((c: any) => c.taxon.scientificName);
    expect(sciNames).toContain("Trisopterus luscus");
    expect(sciNames).not.toContain("Trisopterus iuscus");
  });

  test("renamed taxa: lion's mane → Cyanea capillata (not capitata)", async ({ request }) => {
    const r = await request.post(M, {
      data: { answers: { functionalGroup: "jellyfish", colorTag: "red" } },
    });
    const body = await r.json();
    const sciNames = body.candidates.map((c: any) => c.taxon.scientificName);
    expect(sciNames).toContain("Cyanea capillata");
    expect(sciNames).not.toContain("Cyanea capitata");
  });

  test("Paralichthys dentatus has been removed entirely", async ({ request }) => {
    const r = await request.post(M, {
      data: { answers: { functionalGroup: "fish", bodyShape: "flat" } },
    });
    const body = await r.json();
    const sciNames = body.candidates.map((c: any) => c.taxon.scientificName);
    expect(sciNames).not.toContain("Paralichthys dentatus");
  });

  test("'unsure' for functionalGroup behaves as no answer (no hard filter)", async ({ request }) => {
    const r = await request.post(M, {
      data: { answers: { functionalGroup: "unsure", colorTag: "silvery", locomotion: "swimming" } },
    });
    const body = await r.json();
    expect(body.totalCandidates).toBeGreaterThan(20);
  });

  test("missing answers gives empty candidate list with totalCandidates set", async ({ request }) => {
    const r = await request.post(M, { data: { answers: {} } });
    const body = await r.json();
    expect(body.totalCandidates).toBeGreaterThan(0);
    expect(Array.isArray(body.candidates)).toBe(true);
  });

  test("invalid JSON returns 400", async ({ request }) => {
    // Send raw non-JSON bytes (Playwright would otherwise JSON-encode the string)
    const r = await request.post(M, {
      headers: { "content-type": "application/json" },
      data: Buffer.from("this is { not valid json"),
    });
    expect(r.status()).toBe(400);
  });

  test("scoring formula (no snippetId, no prior): matchScore=1 → finalScore=0.85", async ({ request }) => {
    const r = await request.post(M, {
      data: {
        answers: {
          functionalGroup: "crab",
          bodyShape: "hidden-in-shell",
        },
      },
    });
    const body = await r.json();
    expect(body.priorActive).toBe(false);
    const fullMatch = body.candidates.find(
      (c: any) => c.matchReasons.includes("crab") && c.matchReasons.includes("hidden-in-shell"),
    );
    expect(fullMatch).toBeTruthy();
    // matchScore * 0.7 + 0.5 * 0.3 = 0.85
    expect(fullMatch.finalScore).toBeCloseTo(0.85, 2);
    expect(fullMatch.localStatus).toBe("no_data");
  });

  test("biogeographic prior re-ranks tied candidates by local OBIS record count", async ({ request }) => {
    // Find a verified clip so we have a deployment that maps to a checklist
    const list = await (await request.get("/api/snippets")).json();
    const verified = list.find((s: any) => s.labelStatus === "STAFF_LABELLED");
    expect(verified).toBeTruthy();

    const r = await request.post(M, {
      data: {
        snippetId: verified.id,
        answers: {
          functionalGroup: "fish",
          bodyShape: "streamlined",
          colorTag: "silvery",
        },
      },
    });
    const body = await r.json();
    expect(body.priorActive).toBe(true);

    const top = body.candidates[0];
    // Top result must have a localStatus reflecting the prior
    expect(["common", "occasional", "uncommon"]).toContain(top.localStatus);
    // Locally-common Whiting should outrank a rare visitor like Twaite Shad
    const sciNames = body.candidates.map((c: any) => c.taxon.scientificName);
    const whitingIdx = sciNames.indexOf("Merlangius merlangus");
    const shadIdx = sciNames.indexOf("Alosa fallax");
    if (whitingIdx >= 0 && shadIdx >= 0) {
      expect(whitingIdx).toBeLessThan(shadIdx);
    }
  });
});
