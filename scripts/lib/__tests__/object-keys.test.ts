import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkEtag, md5Hex, multipartEtag } from "../etag";
import {
  HASH_HEX_LENGTH,
  contentHash,
  isContentKey,
  isContentKeyFor,
  keyOfPublicUrl,
  legacyObjectKey,
  objectKey,
} from "../object-keys";

const BASE = "https://aazxphcrexkggbmmceli.supabase.co/storage/v1/object/public/snippets";
const FOLDER = "CYM_Farm_S_2026-06-15_08-00_wrasse00007270_track_manual_86-353_20260828_094841";
const CLIP = Buffer.from("a clip of a fish nobody has named yet");

describe("objectKey", () => {
  it("names an object after its own bytes and nothing else", () => {
    const hash = createHash("sha256").update(CLIP).digest("hex").slice(0, HASH_HEX_LENGTH);
    expect(contentHash(CLIP)).toBe(hash);
    expect(objectKey("video", CLIP)).toBe(`clips/${hash}.mp4`);
    expect(objectKey("video_sd", CLIP)).toBe(`clips/${hash}-sd.mp4`);
    expect(objectKey("thumbnail", CLIP)).toBe(`thumbs/${hash}.jpg`);
  });

  it("takes no folder name, so it cannot carry one", () => {
    // The whole point of the change: two arguments, a kind and the bytes.
    expect(objectKey.length).toBe(2);
    for (const kind of ["video", "video_sd", "thumbnail"] as const) {
      const key = objectKey(kind, CLIP);
      expect(key).toMatch(/^(clips|thumbs)\/[0-9a-f]{24}(-sd)?\.(mp4|jpg)$/);
      expect(key).not.toMatch(/wrasse|crab|CYM|Farm|track|manual|snippet/i);
    }
  });

  it("is stable for the same bytes and different for different bytes", () => {
    expect(objectKey("video", CLIP)).toBe(objectKey("video", Buffer.from(CLIP)));
    expect(objectKey("video", CLIP)).not.toBe(objectKey("video", Buffer.concat([CLIP, Buffer.from("!")])));
  });
});

describe("isContentKey", () => {
  it("recognises the three shapes and rejects everything else", () => {
    for (const kind of ["video", "video_sd", "thumbnail"] as const) {
      expect(isContentKey(objectKey(kind, CLIP))).toBe(true);
    }
    for (const key of [
      legacyObjectKey(FOLDER, "video"),
      legacyObjectKey(FOLDER, "video_sd"),
      legacyObjectKey(FOLDER, "thumbnail"),
      "clips/short.mp4",
      "clips/zzzzzzzzzzzzzzzzzzzzzzzz.mp4",
      "species/3da47e5d04b4c38e2034bc9236d8882b/thumb.webp",
      `thumbs/${contentHash(CLIP)}.png`,
      `clips/${contentHash(CLIP)}.mp4/extra`,
    ]) {
      expect(isContentKey(key), key).toBe(false);
    }
  });

  it("tells the three kinds apart", () => {
    expect(isContentKeyFor("video", objectKey("video", CLIP))).toBe(true);
    expect(isContentKeyFor("video", objectKey("video_sd", CLIP))).toBe(false);
    expect(isContentKeyFor("video_sd", objectKey("video_sd", CLIP))).toBe(true);
    expect(isContentKeyFor("video_sd", objectKey("video", CLIP))).toBe(false);
    expect(isContentKeyFor("thumbnail", objectKey("thumbnail", CLIP))).toBe(true);
    expect(isContentKeyFor("thumbnail", objectKey("video", CLIP))).toBe(false);
  });
});

describe("legacyObjectKey", () => {
  it("is the pre-rename layout the migration has to recognise", () => {
    expect(legacyObjectKey(FOLDER, "video")).toBe(`${FOLDER}/snippet.mp4`);
    expect(legacyObjectKey(FOLDER, "video_sd")).toBe(`${FOLDER}/snippet_720.mp4`);
    expect(legacyObjectKey(FOLDER, "thumbnail")).toBe(`${FOLDER}/thumbnail.jpg`);
  });
});

describe("keyOfPublicUrl", () => {
  it("returns the key under a base, without the cache-buster", () => {
    expect(keyOfPublicUrl(`${BASE}/${FOLDER}/snippet.mp4?v=4`, BASE)).toBe(`${FOLDER}/snippet.mp4`);
    expect(keyOfPublicUrl(`${BASE}/clips/${contentHash(CLIP)}.mp4`, `${BASE}/`)).toBe(
      `clips/${contentHash(CLIP)}.mp4`,
    );
  });

  it("decodes a folder name with spaces and parentheses", () => {
    const folder = "META_2023-10-01-BRUV1_EXOMATT_D1_OCT23 (5)_trackmanual_1_0-496_20260619_171422";
    const url = `${BASE}/${encodeURIComponent(folder)}/thumbnail.jpg?v=3`;
    expect(keyOfPublicUrl(url, BASE)).toBe(`${folder}/thumbnail.jpg`);
  });

  it("is null for a URL on another host or bucket", () => {
    expect(keyOfPublicUrl("https://media.fishspotter.app/clips/abc.mp4", BASE)).toBeNull();
    expect(keyOfPublicUrl(`${BASE}-other/clips/abc.mp4`, BASE)).toBeNull();
    expect(keyOfPublicUrl(BASE, BASE)).toBeNull();
  });
});

describe("checkEtag", () => {
  it("accepts the MD5 of a single-part upload, quoted or not", () => {
    expect(checkEtag(CLIP, md5Hex(CLIP))).toBe("md5");
    expect(checkEtag(CLIP, `"${md5Hex(CLIP)}"`)).toBe("md5");
  });

  it("rejects bytes that are not the object", () => {
    expect(checkEtag(Buffer.from("something else"), md5Hex(CLIP))).toBe("no-match");
  });

  it("accepts a multipart ETag at one of the usual part sizes", () => {
    const big = Buffer.alloc(11 * 1024 * 1024, 7);
    const etag = multipartEtag(big, 5 * 1024 * 1024);
    expect(etag.endsWith("-3")).toBe(true);
    expect(checkEtag(big, etag)).toBe("multipart");
    expect(checkEtag(Buffer.alloc(11 * 1024 * 1024, 8), etag)).toBe("no-match");
  });

  it("says so when there is no ETag to check against", () => {
    expect(checkEtag(CLIP, null)).toBe("no-etag");
    expect(checkEtag(CLIP, "")).toBe("no-etag");
  });
});
