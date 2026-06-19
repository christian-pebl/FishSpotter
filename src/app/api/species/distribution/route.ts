import { NextResponse } from "next/server";
import { getCachedDistribution } from "@/lib/biodiversity/species-cache";
import { CATALOGUE } from "@/lib/idguide/catalogue";

/**
 * OBIS occurrence-density grid for a catalogue species ("where it's seen"),
 * served from the read-through cache (instant). The `name` is guarded to a
 * catalogue species so an arbitrary value can't trigger a fresh OBIS fetch.
 * Public reference data — mirrors /api/species/depth.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const name = new URL(req.url).searchParams.get("name");
  if (!name || !(name in CATALOGUE)) {
    return NextResponse.json({ grid: null });
  }
  const grid = await getCachedDistribution(name);
  return NextResponse.json({ grid });
}
