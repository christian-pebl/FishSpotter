/**
 * Side-by-side "tell them apart" comparison groups (18 Jun 2026).
 *
 * Some Rung-3 candidate sets are genuine look-alikes a beginner cannot separate
 * from a single photo (the classic case: the three right-eyed flatfish, which
 * all change colour to match the seabed). For those, the candidate gate offers a
 * "Compare side by side" view that lines the look-alikes up with the ONE cue
 * that separates each, drawn from UK ID guides and agency species pages.
 *
 * Each member's `headline` is the single most diagnostic, video-visible cue; the
 * `also` line adds the supporting features. `tip` is the quickest decision route
 * across the whole group; `caveat` flags any real-world trap (e.g. hybrids).
 *
 * Sources for the flatfish group (cross-checked, all agree):
 *  - Sussex IFCA Fish ID Guide (decision-tree/id-guides/sussex-ifca-fish-id.pdf):
 *    "plaice topside smooth apart from bony tubercles between eyes"; "flounder
 *    rows of short prickles along the fin bases"; "dab lateral line curved above
 *    pectoral fin (D for dab)".
 *  - MarLIN species pages (plaice 2172, dab 2174, flounder 1495).
 *  - FishBase; ZSL estuarine fish guide; the Wildlife Trusts.
 * The plaice x flounder hybrid caveat is from the Wildlife Trusts + MarLIN.
 */

export type ComparisonMember = {
  scientificName: string;
  commonName: string;
  /** The single most diagnostic, video-visible cue for this species. */
  headline: string;
  /** Supporting visible features. */
  also: string;
};

export type ComparisonSource = {
  label: string;
  /** Public URL, or "" for a local/offline reference (rendered as plain text). */
  url: string;
};

export type ComparisonGroup = {
  id: string;
  /** Gate-style question shown at the top of the compare view. */
  title: string;
  /** One or two sentences on why they're confused + the fastest single check. */
  intro: string;
  members: ComparisonMember[];
  /** Plain-English "quickest way to tell all of them apart". */
  tip: string;
  /** Optional real-world trap to flag (hybrids, reversed individuals, etc.). */
  caveat?: string;
  sources: ComparisonSource[];
};

export const COMPARISON_GROUPS: ComparisonGroup[] = [
  {
    id: "flatfish-right-eyed",
    title: "Plaice, dab or flounder?",
    intro:
      "All three are right-eyed flatfish that change colour to match the seabed, so colour alone will not decide it. The quickest single check is the lateral line where it passes over the pectoral fin.",
    members: [
      {
        scientificName: "Pleuronectes platessa",
        commonName: "Plaice",
        headline: "Bold, bright orange spots on smooth skin.",
        also: "A row of bony knobs runs from between the eyes back toward the gill cover (clearest on bigger fish). The lateral line is only gently curved.",
      },
      {
        scientificName: "Limanda limanda",
        commonName: "Dab",
        headline: 'Lateral line arches in a high half-circle (a "D") over the pectoral fin.',
        also: "Skin looks rough and sandy rather than glossy. Pale and mottled with faint spots at most, and it is the smallest of the three.",
      },
      {
        scientificName: "Platichthys flesus",
        commonName: "Flounder",
        headline: "Rough, prickly ridges along the bases of the top and bottom fins.",
        also: "Duller brown with muddy reddish spots, and a nearly straight lateral line. The one you meet in estuaries and brackish water.",
      },
    ],
    tip: 'Lateral line loops up like a "D" over the pectoral fin? Dab. Nearly straight, with bright orange spots and smooth skin? Plaice. Nearly straight, with duller spots and rough ridges along the fin edges (often in an estuary)? Flounder.',
    caveat:
      "Plaice and flounder can hybridise, so weigh two or three cues before you commit rather than relying on one.",
    sources: [
      { label: "Sussex IFCA Fish ID Guide", url: "" },
      { label: "MarLIN", url: "https://www.marlin.ac.uk" },
    ],
  },
];

/**
 * The comparison group for a Rung-3 candidate set, or null. A group applies when
 * every one of its members is present among the candidates AND the candidate set
 * is small enough to be dominated by the group (so the whole-catalogue "Not sure"
 * path, which also contains all the flatfish, does not surface it). The threshold
 * (members + 3) keeps it to a genuinely narrow, look-alike set.
 */
export function comparisonGroupForCandidates(
  scientificNames: string[],
): ComparisonGroup | null {
  const set = new Set(scientificNames);
  for (const g of COMPARISON_GROUPS) {
    const allPresent = g.members.every((m) => set.has(m.scientificName));
    if (allPresent && scientificNames.length <= g.members.length + 3) return g;
  }
  return null;
}
