import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { QuestionKey } from "@/lib/id-guide-questions";
import { BiogeographicPrior, type LocalStatus } from "@/lib/biogeographic-prior";

const TAXON_SELECT = {
  id: true,
  name: true,
  scientificName: true,
  funFact: true,
  description: true,
  heroImageUrl: true,
  habitatNote: true,
  isFunctionalGroup: true,
} as const;

const ANSWER_KEYS: QuestionKey[] = ["functionalGroup", "locomotion", "screenZone", "bodyShape", "colorTag"];

interface MatchRequest {
  snippetId?: string;
  answers?: Partial<Record<QuestionKey, string>>;
}

/**
 * Look up the best-matching biogeographic checklist for a given snippet.
 * Returns the prior helper (or one with no data, which yields neutral 0.5).
 */
async function loadPriorForSnippet(snippetId: string | undefined): Promise<BiogeographicPrior> {
  if (!snippetId) return new BiogeographicPrior(null);
  const snippet = await prisma.snippet.findUnique({
    where: { id: snippetId },
    select: { deployment: true, depthM: true },
  });
  if (!snippet?.deployment) return new BiogeographicPrior(null);

  // Find the cache row whose depth bucket contains this snippet's depth.
  // Prefer "all" season for v1; switch to seasonal once we populate those rows.
  const list = await prisma.biogeographicChecklist.findMany({
    where: { deployment: snippet.deployment, season: "all" },
    orderBy: { fetchedAt: "desc" },
  });

  let chosen = list.find((r) => {
    if (snippet.depthM == null) return true;
    return snippet.depthM >= r.depthBucketMin && snippet.depthM <= r.depthBucketMax;
  });
  if (!chosen) chosen = list[0]; // fall back to any row for this deployment

  return new BiogeographicPrior(chosen?.occurrencesJson ?? null);
}

export async function POST(req: Request) {
  let body: MatchRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const answers = (body.answers ?? {}) as Partial<Record<QuestionKey, string>>;

  // Filter out empty strings + the "unsure" sentinel for functionalGroup
  const cleanAnswers: Partial<Record<QuestionKey, string>> = {};
  for (const k of ANSWER_KEYS) {
    const v = answers[k];
    if (v && v !== "unsure" && v.trim() !== "") cleanAnswers[k] = v;
  }
  const numAnswered = Object.keys(cleanAnswers).length;

  // Hard filter on functionalGroup if provided
  let candidateTaxa: { id: string }[];
  if (cleanAnswers.functionalGroup) {
    candidateTaxa = await prisma.taxon.findMany({
      where: {
        isFunctionalGroup: false,
        attributes: {
          some: { key: "functionalGroup", value: cleanAnswers.functionalGroup },
        },
      },
      select: { id: true },
    });
  } else {
    candidateTaxa = await prisma.taxon.findMany({
      where: { isFunctionalGroup: false },
      select: { id: true },
    });
  }

  if (candidateTaxa.length === 0) {
    return NextResponse.json({ candidates: [], totalCandidates: 0 });
  }

  const candidateIds = candidateTaxa.map((t) => t.id);

  // Pull all attributes for the candidate set
  const allAttrs = await prisma.taxonAttribute.findMany({
    where: { taxonId: { in: candidateIds } },
    select: { taxonId: true, key: true, value: true },
  });

  // Group by taxon
  const attrsByTaxon = new Map<string, Map<string, Set<string>>>();
  for (const a of allAttrs) {
    let perTaxon = attrsByTaxon.get(a.taxonId);
    if (!perTaxon) {
      perTaxon = new Map();
      attrsByTaxon.set(a.taxonId, perTaxon);
    }
    let valuesForKey = perTaxon.get(a.key);
    if (!valuesForKey) {
      valuesForKey = new Set();
      perTaxon.set(a.key, valuesForKey);
    }
    valuesForKey.add(a.value);
  }

  // Pre-load biogeographic prior (one DB round-trip)
  const prior = await loadPriorForSnippet(body.snippetId);

  // Pull taxa
  const taxa = await prisma.taxon.findMany({
    where: { id: { in: candidateIds } },
    select: TAXON_SELECT,
  });

  const scored = taxa.map((taxon) => {
    const taxonAttrs = attrsByTaxon.get(taxon.id) ?? new Map();
    const matchReasons: string[] = [];
    let matched = 0;

    for (const k of ANSWER_KEYS) {
      const userVal = cleanAnswers[k];
      if (!userVal) continue;
      const taxonVals = taxonAttrs.get(k);
      if (taxonVals && taxonVals.has(userVal)) {
        matched++;
        matchReasons.push(userVal);
      }
    }

    const matchScore = numAnswered > 0 ? matched / numAnswered : 0;
    const priorResult = prior.forScientificName(taxon.scientificName);
    const finalScore = matchScore * 0.7 + priorResult.score * 0.3;

    return {
      taxon,
      matchScore,
      priorScore: priorResult.score,
      localStatus: priorResult.status as LocalStatus,
      localRecords: priorResult.records,
      finalScore,
      matchReasons,
    };
  });

  // Sort by final score, return top 5 with score >= 0.4
  scored.sort((a, b) => b.finalScore - a.finalScore);
  const top = scored.filter((c) => c.finalScore >= 0.4).slice(0, 5);
  const candidates = top.length >= 1 ? top : scored.slice(0, 3);

  return NextResponse.json({
    candidates,
    totalCandidates: scored.length,
    priorActive: prior.hasData(),
  });
}
