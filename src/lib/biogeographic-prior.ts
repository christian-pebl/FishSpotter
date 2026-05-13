// Compute a biogeographic prior score (0..1) for a taxon at a given deployment,
// from cached OBIS occurrence counts. Used as a soft tie-breaker in the ID-guide
// matcher: locally-common species get a small score boost over rare visitors.

const PRIOR_NEUTRAL = 0.5; // when we have no data for this taxon → don't penalise

export type LocalStatus =
  | "common" // top quartile of locally-recorded species
  | "occasional" // present in OBIS but not abundant
  | "uncommon" // not in OBIS for this area at this depth
  | "no_data"; // no checklist for this deployment yet

export interface PriorResult {
  score: number; // 0..1
  status: LocalStatus;
  records?: number;
}

/**
 * Build a fast lookup over a deployment's checklist for repeated calls.
 * Pre-computes the log-scale normaliser so each per-taxon call is O(1).
 */
export class BiogeographicPrior {
  private occurrences: Record<string, number>;
  private logMax: number;
  private commonThreshold: number;

  constructor(occurrencesJson: string | null | undefined) {
    if (!occurrencesJson) {
      this.occurrences = {};
      this.logMax = 0;
      this.commonThreshold = Infinity;
      return;
    }
    try {
      this.occurrences = JSON.parse(occurrencesJson);
    } catch {
      this.occurrences = {};
    }
    const counts = Object.values(this.occurrences);
    if (counts.length === 0) {
      this.logMax = 0;
      this.commonThreshold = Infinity;
      return;
    }
    const max = Math.max(...counts);
    this.logMax = Math.log(max + 1);
    // 75th percentile cut for "common" label
    const sorted = [...counts].sort((a, b) => a - b);
    this.commonThreshold = sorted[Math.floor(sorted.length * 0.75)] ?? max;
  }

  /** Did the cache load anything at all? */
  hasData(): boolean {
    return Object.keys(this.occurrences).length > 0;
  }

  /**
   * Returns the prior for a taxon by scientific name.
   * - No checklist available → neutral 0.5, status "no_data".
   * - Taxon not in checklist → 0.4 (mild penalty), status "uncommon".
   * - Taxon in checklist → log-normalised score 0.5..1.0, status "occasional" or "common".
   */
  forScientificName(scientificName: string | null | undefined): PriorResult {
    if (!this.hasData()) return { score: PRIOR_NEUTRAL, status: "no_data" };
    if (!scientificName) return { score: 0.4, status: "uncommon" };

    const records = this.occurrences[scientificName];
    if (records == null) return { score: 0.4, status: "uncommon" };

    // Log-scale normalisation onto 0.5..1.0
    const norm = this.logMax > 0 ? Math.log(records + 1) / this.logMax : 1;
    const score = 0.5 + Math.min(1, Math.max(0, norm)) * 0.5;
    const status: LocalStatus = records >= this.commonThreshold ? "common" : "occasional";
    return { score, status, records };
  }
}
