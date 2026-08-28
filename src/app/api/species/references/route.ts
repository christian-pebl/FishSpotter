import { NextResponse } from "next/server";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { getSpeciesProvenance } from "@/lib/references/payload";
import { getSpeciesDiet } from "@/lib/foodweb/diet";

/**
 * Provenance for a catalogue species: its taxonomic anchor, the verified
 * open-access sources behind its guide, and which claim each source backs.
 *
 * Served rather than bundled so the reference catalogue (and the passages read
 * out of it) stay on the server. `name` is guarded to a catalogue species, and
 * the response is public reference data, cached at the edge.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const name = new URL(req.url).searchParams.get("name");
  if (!name || !(name in CATALOGUE)) {
    return NextResponse.json({ provenance: null, diet: null });
  }
  const provenance = getSpeciesProvenance(name);
  // The ID-flow popup renders the same guide but has no server pass, so its
  // food-web section comes from here rather than bundling the graph.
  const diet = getSpeciesDiet(name);
  return NextResponse.json(
    { provenance, diet },
    { headers: { "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
