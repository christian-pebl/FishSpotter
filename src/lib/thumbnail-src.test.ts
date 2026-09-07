import { describe, expect, it } from "vitest";
import { THUMBNAIL_QUALITY, THUMBNAIL_WIDTH, thumbnailSrc } from "./thumbnail-src";

const THUMB =
  "https://aazxphcrexkggbmmceli.supabase.co/storage/v1/object/public/snippets/ALG_2020/thumbnail.jpg?v=4";

describe("thumbnailSrc", () => {
  it("routes a remote thumbnail through the image optimizer at a device width", () => {
    const src = thumbnailSrc(THUMB);
    expect(src.startsWith("/_next/image?url=")).toBe(true);
    const params = new URL(src, "http://localhost").searchParams;
    expect(params.get("url")).toBe(THUMB);
    expect(params.get("w")).toBe(String(THUMBNAIL_WIDTH));
    expect(params.get("q")).toBe(String(THUMBNAIL_QUALITY));
  });

  it("keeps the cache-busting query on the source URL intact", () => {
    // `?v=` is what tells both the browser and the optimizer that a re-cut
    // clip has a new still; losing it would pin the old picture.
    const params = new URL(thumbnailSrc(THUMB), "http://localhost").searchParams;
    expect(params.get("url")).toContain("?v=4");
  });

  it("uses one of Next's default device widths, which is what the optimizer accepts", () => {
    const DEVICE_SIZES = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];
    expect(DEVICE_SIZES).toContain(THUMBNAIL_WIDTH);
  });

  it("leaves relative and data URLs alone", () => {
    expect(thumbnailSrc("/hero/velvet-crab-preview.jpg")).toBe("/hero/velvet-crab-preview.jpg");
    expect(thumbnailSrc("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  });
});
