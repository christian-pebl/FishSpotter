const GBIF_MATCH = "https://api.gbif.org/v1/species/match";

export type NameMatchResult = {
  scientificName: string | null;
  confidence: string | null;
};

type GbifMatchResponse = {
  scientificName?: string;
  acceptedScientificName?: string;
  canonicalName?: string;
  acceptedCanonicalName?: string;
  matchType?: string; // EXACT | FUZZY | HIGHERRANK | NONE
  class?: string;
};

export function normaliseCommonName(name: string): string {
  return name.trim().toLowerCase();
}

// OBIS occurrence rows return the binomial without authorship
// ("Pollachius pollachius"), whereas GBIF's `scientificName` includes
// authorship ("Pollachius pollachius (Linnaeus, 1758)"). Falling back to
// the raw scientificName previously broke every probability join.
function pickCanonical(json: GbifMatchResponse): string | null {
  return (
    json.acceptedCanonicalName?.trim() ||
    json.canonicalName?.trim() ||
    stripAuthorship(json.acceptedScientificName ?? json.scientificName) ||
    null
  );
}

function stripAuthorship(name: string | undefined | null): string | null {
  if (!name) return null;
  // Drop parenthetical or trailing author/year — anything after the first comma
  // or open-paren on the right of the binomial.
  const cleaned = name.replace(/\s*[\(,].*$/, "").trim();
  return cleaned.length > 0 ? cleaned : null;
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

  if (json.matchType === "NONE") {
    return { scientificName: null, confidence: json.matchType };
  }

  const canonical = pickCanonical(json);
  if (!canonical) return { scientificName: null, confidence: json.matchType ?? "NONE" };

  return {
    scientificName: canonical,
    confidence: json.matchType ?? null,
  };
}
