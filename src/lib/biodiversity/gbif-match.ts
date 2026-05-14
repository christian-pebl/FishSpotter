const GBIF_MATCH = "https://api.gbif.org/v1/species/match";

export type NameMatchResult = {
  scientificName: string | null;
  confidence: string | null;
};

type GbifMatchResponse = {
  scientificName?: string;
  acceptedScientificName?: string;
  matchType?: string; // EXACT | FUZZY | HIGHERRANK | NONE
  class?: string;
};

export function normaliseCommonName(name: string): string {
  return name.trim().toLowerCase();
}

export async function resolveCommonName(name: string): Promise<NameMatchResult> {
  const query = name.trim();
  if (!query) return { scientificName: null, confidence: null };

  const url = new URL(GBIF_MATCH);
  url.searchParams.set("name", query);
  url.searchParams.set("verbose", "false");

  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`GBIF match ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as GbifMatchResponse;

  if (json.matchType === "NONE" || !json.scientificName) {
    return { scientificName: null, confidence: json.matchType ?? "NONE" };
  }

  return {
    scientificName: json.acceptedScientificName ?? json.scientificName,
    confidence: json.matchType ?? null,
  };
}
