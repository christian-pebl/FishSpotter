import { NextResponse } from "next/server";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { getSpeciesFacts } from "@/lib/biodiversity/species-facts";

/**
 * The depth range a published source states for a catalogue species.
 *
 * This used to serve a figure computed from OBIS occurrence records. That was
 * survey-gear geometry rather than animal depth, and it put "usually seen at
 * ~0 m" on the grey seal and great cormorant pages, because an air-breather is
 * recorded at the surface by construction.
 *
 * It now reads the same `species-facts.json` entry the guide's depth tile
 * renders, rather than a second file of its own. Depth was briefly held in two
 * places, and the failure that follows from that is well documented in this
 * codebase: a source of truth moves and its machine-readable copy does not.
 * Returns null for a species where no source states a range, and consumers
 * show nothing rather than a computed guess.
 *
 * `name` is guarded to a catalogue species. Public reference data.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const name = new URL(req.url).searchParams.get("name");
  if (!name || !(name in CATALOGUE)) {
    return NextResponse.json({ depth: null });
  }
  const depth = getSpeciesFacts(name)?.depth ?? null;
  return NextResponse.json(
    { depth: depth ? { label: depth.text } : null },
    { headers: { "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
