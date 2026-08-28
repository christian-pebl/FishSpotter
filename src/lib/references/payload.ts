/**
 * The provenance payload the species guide renders.
 *
 * Built on the server and either passed straight into the page (the /species
 * profile, which server-renders) or fetched by the client popup, so the full
 * reference catalogue and its quotes never ship in the browser bundle.
 *
 * Only sources that PASSED verification are offered to a reader. A citation
 * pointing at a dead or wrong page is worse than no citation, because it looks
 * like diligence.
 */

import { CATALOGUE } from "@/lib/idguide/catalogue";
import { REFERENCES, formatCitation, getSource, referencesFor, sourcesFor, type ResolvedSource } from "./catalogue";
import type { Identity } from "./schema";

export type SourcePayload = {
  id: string;
  kind: string;
  title: string;
  publisher: string;
  year?: number;
  url?: string;
  licence?: string;
  citation: string;
  /** Date this link was last proved to resolve and to be about this species. */
  checkedOn?: string;
};

export type ClaimSupportPayload = {
  sourceId: string;
  /** Where in the source, e.g. "Identifying features", "p. 62". */
  locator: string;
  /** The passage that carries the claim, so a reader can check it in place. */
  quote?: string;
};

export type ClaimPayload = {
  /** Ids into `sources`, in citation order. */
  sourceIds: string[];
  /**
   * The passages behind this claim. Shipped per species (never bundled), so a
   * reader can see the sentence a claim rests on without leaving the page.
   * This is the difference between "here is a citation" and "here is why".
   */
  support: ClaimSupportPayload[];
  /** True when a read passage was recorded and judged to carry the claim. */
  evidenced: boolean;
  /**
   * Set when the source CONTRADICTS what the app currently says.
   *
   * This must reach the reader. A contradicted claim that still renders a
   * citation is the worst state in the system: the marker says "we checked"
   * while the checking is what found the sentence to be wrong.
   */
  conflict?: string;
};

export type SpeciesProvenance = {
  identity: Identity | null;
  sources: SourcePayload[];
  /** Claim key -> which sources back it. Only claims with a live source appear. */
  claims: Record<string, ClaimPayload>;
  /** Total claims bound vs the total the audit knows about, for the honesty note. */
  summary: { sourceCount: number; claimsBound: number; claimsEvidenced: number; conflicts: number };
};

function toPayload(s: ResolvedSource): SourcePayload {
  return {
    id: s.id,
    kind: s.kind,
    title: s.title,
    publisher: s.publisher,
    year: s.year,
    url: s.url,
    licence: s.licence,
    citation: formatCitation(s),
    checkedOn: s.verification?.checkedOn,
  };
}

export function getSpeciesProvenance(scientificName: string): SpeciesProvenance | null {
  if (!(scientificName in CATALOGUE)) return null;
  const entry = referencesFor(scientificName);
  if (!entry) return null;

  // Verified sources only. An unverified link is held back rather than shown.
  const live = sourcesFor(scientificName).filter((s) => s.linkVerified);
  const liveIds = new Set(live.map((s) => s.id));

  const claims: Record<string, ClaimPayload> = {};
  let evidencedCount = 0;
  for (const [key, claim] of Object.entries(entry.claims)) {
    const ids = claim.sourceIds.filter((id) => liveIds.has(id));
    if (ids.length === 0) continue;
    claims[key] = {
      sourceIds: ids,
      support: claim.support
        .filter((sp) => liveIds.has(sp.sourceId))
        .map((sp) => ({ sourceId: sp.sourceId, locator: sp.locator, quote: sp.quote })),
      evidenced: claim.claimSupported,
      conflict: claim.conflict,
    };
    if (claim.claimSupported) evidencedCount++;
  }

  // "Eats me" links are claims about the PREDATOR's diet, so they live on the
  // predator's entry, not this one. Pull in any edge claim whose prey is this
  // species, along with the source that backs it, so the page can cite what
  // eats it rather than showing that half of the section bare.
  const extraSources: ResolvedSource[] = [];
  const preyMarker = `edge:${CATALOGUE[scientificName].commonName}->`;
  for (const [otherName, otherEntry] of Object.entries(REFERENCES.species)) {
    if (otherName === scientificName) continue;
    for (const [key, claim] of Object.entries(otherEntry.claims)) {
      if (!key.startsWith(preyMarker)) continue;
      const resolved = claim.sourceIds
        .map(getSource)
        .filter((s): s is ResolvedSource => s !== null && s.linkVerified);
      if (resolved.length === 0) continue;
      for (const s of resolved) {
        if (!liveIds.has(s.id) && !extraSources.some((e) => e.id === s.id)) extraSources.push(s);
      }
      claims[key] = {
        sourceIds: resolved.map((s) => s.id),
        support: claim.support.map((sp) => ({
          sourceId: sp.sourceId,
          locator: sp.locator,
          quote: sp.quote,
        })),
        evidenced: claim.claimSupported,
        conflict: claim.conflict,
      };
      if (claim.claimSupported) evidencedCount++;
    }
  }

  return {
    identity: entry.identity ?? null,
    sources: [...live, ...extraSources].map(toPayload),
    claims,
    summary: {
      sourceCount: live.length + extraSources.length,
      claimsBound: Object.keys(claims).length,
      claimsEvidenced: evidencedCount,
      conflicts: Object.values(claims).filter((c) => c.conflict).length,
    },
  };
}
