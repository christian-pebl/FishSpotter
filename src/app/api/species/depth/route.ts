import { NextResponse } from "next/server";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { getStatedDepth } from "@/lib/biodiversity/stated-depth";

/**
 * The depth range a published source states for a catalogue species.
 *
 * This used to serve a figure computed from OBIS occurrence records. That was
 * survey-gear geometry rather than animal depth, and it put "usually seen at
 * ~0 m" on the grey seal and great cormorant pages, because an air-breather is
 * recorded at the surface by construction. It now serves what FishBase, MarLIN
 * or SCOS actually say, and returns null for the 10 species where no source
 * states a range. Consumers show nothing rather than a computed guess.
 *
 * `name` is guarded to a catalogue species. Public reference data.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const name = new URL(req.url).searchParams.get("name");
  if (!name || !(name in CATALOGUE)) {
    return NextResponse.json({ depth: null });
  }
  return NextResponse.json(
    { depth: getStatedDepth(name) },
    { headers: { "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
