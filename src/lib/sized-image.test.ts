import { describe, expect, it } from "vitest";
import {
  LOCAL_IMAGE_FOLDERS,
  TILE_WIDTHS,
  canOptimize,
  optimizedSrc,
  optimizerHosts,
  sizedImage,
  smallerThirdParty,
} from "./sized-image";

const SUPABASE = "https://aazxphcrexkggbmmceli.supabase.co";
const HOSTS = optimizerHosts({ SUPABASE_URL: SUPABASE });
const OUR_THUMB = `${SUPABASE}/storage/v1/object/public/snippets/species/3da47e5d04b4c38e2034bc9236d8882b/thumb.webp`;

describe("optimizerHosts", () => {
  it("lists the storage host and the R2 fallback, once each", () => {
    expect(HOSTS).toContain("aazxphcrexkggbmmceli.supabase.co");
    expect(HOSTS).toContain("pub-b0fda9a751144df59165871565716de4.r2.dev");
    expect(new Set(HOSTS).size).toBe(HOSTS.length);
  });

  it("falls back to the public variable and survives a malformed one", () => {
    expect(optimizerHosts({ NEXT_PUBLIC_SUPABASE_URL: SUPABASE })).toContain(
      "aazxphcrexkggbmmceli.supabase.co",
    );
    expect(optimizerHosts({ SUPABASE_URL: "not a url" })).toEqual([
      "pub-b0fda9a751144df59165871565716de4.r2.dev",
    ]);
  });

  it("agrees with next.config.mjs, so an optimizable URL is one the optimizer serves", async () => {
    // The config reads the same variables at import time.
    const before = { ...process.env };
    process.env.SUPABASE_URL = SUPABASE;
    delete process.env.R2_PUBLIC_URL;
    try {
      const config = (await import("../../next.config.mjs")).default as {
        images: {
          remotePatterns: { hostname: string }[];
          localPatterns: { pathname: string; search?: string }[];
        };
      };
      const allowed = config.images.remotePatterns.map((p) => p.hostname);
      for (const host of optimizerHosts(process.env)) expect(allowed).toContain(host);

      const local = config.images.localPatterns;
      for (const folder of LOCAL_IMAGE_FOLDERS) {
        const pattern = local.find((p) => p.pathname === `${folder}**`);
        expect(pattern, `next.config.mjs localPatterns is missing ${folder}`).toBeDefined();
        // Exact path only: canOptimize refuses a local URL with a query string.
        expect(pattern!.search).toBe("");
      }
    } finally {
      process.env = before;
    }
  });
});

describe("canOptimize", () => {
  it("accepts pictures PEBL hosts", () => {
    expect(canOptimize(OUR_THUMB, HOSTS)).toBe(true);
    expect(canOptimize("/farm-media/kaly/hero.webp", HOSTS)).toBe(true);
    expect(canOptimize("/hero/velvet-crab-preview.jpg", HOSTS)).toBe(true);
  });

  it("refuses third-party hosts, other local paths, query strings and http", () => {
    expect(canOptimize("https://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg", HOSTS)).toBe(false);
    expect(canOptimize("https://inaturalist-open-data.s3.amazonaws.com/photos/1/medium.jpg", HOSTS)).toBe(false);
    expect(canOptimize("/api/health", HOSTS)).toBe(false);
    expect(canOptimize("/farm-media/kaly/hero.webp?v=2", HOSTS)).toBe(false);
    expect(canOptimize(OUR_THUMB.replace("https://", "http://"), HOSTS)).toBe(false);
    expect(canOptimize("data:image/png;base64,AAAA", HOSTS)).toBe(false);
  });
});

describe("smallerThirdParty", () => {
  it("steps a wide Wikimedia thumbnail down to 500 px and leaves narrower ones alone", () => {
    expect(
      smallerThirdParty(
        "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Chelon_labrosus_Pillon.jpg/960px-Chelon_labrosus_Pillon.jpg",
      ),
    ).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Chelon_labrosus_Pillon.jpg/500px-Chelon_labrosus_Pillon.jpg",
    );
    for (const px of [250, 330, 500]) {
      const narrow = `https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Chelon_labrosus_Pillon.jpg/${px}px-Chelon_labrosus_Pillon.jpg`;
      expect(smallerThirdParty(narrow)).toBe(narrow);
    }
  });

  it("leaves iNaturalist photos as they are: the next size down is too soft for a card", () => {
    for (const url of [
      "https://inaturalist-open-data.s3.amazonaws.com/photos/384826554/medium.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/635675826/square.jpg",
      "https://static.inaturalist.org/photos/12/large.jpeg?1600000000",
    ]) {
      expect(smallerThirdParty(url)).toBe(url);
    }
  });

  it("leaves a Wikimedia original, a prefixed thumbnail and unknown hosts unchanged", () => {
    for (const url of [
      "https://upload.wikimedia.org/wikipedia/commons/e/ea/Chelon_labrosus_Pillon.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Plate.pdf/page1-960px-Plate.pdf.jpg",
      "https://live.staticflickr.com/65535/1234_abcd_b.jpg",
      "https://www.artsobservasjoner.no/MediaLibrary/2020/1/x.jpg",
    ]) {
      expect(smallerThirdParty(url)).toBe(url);
    }
  });
});

describe("sizedImage", () => {
  it("sends a PEBL-hosted picture through the optimizer at both tile widths", () => {
    const image = sizedImage(OUR_THUMB, HOSTS);
    expect(image.src).toBe(optimizedSrc(OUR_THUMB, TILE_WIDTHS[0]));
    expect(image.srcSet).toBe(
      TILE_WIDTHS.map((w) => `${optimizedSrc(OUR_THUMB, w)} ${w}w`).join(", "),
    );
    expect(image.fallbackSrc).toBe(OUR_THUMB);
    expect(image.crossOrigin).toBeUndefined();
    // Both are widths the optimizer accepts (Next's default imageSizes).
    for (const w of TILE_WIDTHS) expect([32, 48, 64, 96, 128, 256, 384]).toContain(w);
  });

  it("carries the whole source URL, encoded, in the optimizer address", () => {
    const params = new URL(sizedImage("/farm-media/kaly/hero.webp", HOSTS).src, "http://localhost").searchParams;
    expect(params.get("url")).toBe("/farm-media/kaly/hero.webp");
    expect(params.get("w")).toBe("256");
    expect(params.get("q")).toBe("75");
  });

  it("keeps a third-party photo off the optimizer and loads Wikimedia without credentials", () => {
    const wiki = sizedImage(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Lipophrys_pholis_France.jpg/960px-Lipophrys_pholis_France.jpg",
      HOSTS,
    );
    expect(wiki.src.startsWith("https://upload.wikimedia.org/")).toBe(true);
    expect(wiki.src).toContain("/500px-");
    expect(wiki.srcSet).toBeUndefined();
    expect(wiki.crossOrigin).toBe("anonymous");
    expect(wiki.fallbackSrc).toContain("/960px-");

    const inatUrl = "https://inaturalist-open-data.s3.amazonaws.com/photos/601555050/medium.jpg";
    const inat = sizedImage(inatUrl, HOSTS);
    expect(inat.src).toBe(inatUrl);
    expect(inat.srcSet).toBeUndefined();
    expect(inat.crossOrigin).toBeUndefined();
  });
});
