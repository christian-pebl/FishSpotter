import { NextResponse } from "next/server";
import { getCachedDepth } from "@/lib/biodiversity/species-cache";
import { CATALOGUE } from "@/lib/idguide/catalogue";

/**
 * Typical-depth band for a catalogue species (Anjali: "this species is most
 * commonly found at this depth"). Reads the cache (instant); the `name` is
 * guarded to a catalogue species so an arbitrary value can't trigger a fresh
 * OBIS fetch. Public reference data.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const name = new URL(req.url).searchParams.get("name");
  if (!name || !(name in CATALOGUE)) {
    return NextResponse.json({ depth: null });
  }
  const depth = await getCachedDepth(name);
  return NextResponse.json({
    depth: depth
      ? {
          label: depth.label,
          medianM: Math.round(depth.medianM),
          minM: Math.round(depth.minM),
          maxM: Math.round(depth.maxM),
        }
      : null,
  });
}
