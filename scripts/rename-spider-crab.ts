/**
 * One-off migration: "Hyas araneus" (Great Spider Crab) -> "Majoidea" (Spider Crab).
 *
 * The UK spider crabs (great / spiny / scorpion) cannot reliably be told apart
 * on a video clip, so the catalogue entry was generalised to the superfamily
 * and renamed "Spider Crab" (1 Aug 2026). The catalogue JSON is the source of
 * truth for the key; this script re-points the DB rows that key into it.
 *
 * Touched:
 *   SpeciesImage.scientificName        Hyas araneus -> Majoidea
 *   DiagnosticMark.scientificName      Hyas araneus -> Majoidea
 *   UnlockedSpecies.scientificName     Hyas araneus -> Majoidea (dedup-safe)
 *   Answer.chosenOption                "Great Spider Crab" -> "Spider Crab"
 *   Snippet.staffAnswer                same rename (legacy reference labels)
 *   ConsensusEvent.normalisedName      re-normalised to the new label
 *   SpeciesDepthCache / SpeciesDistributionCache   old rows dropped (read-through
 *                                      cache; refetch under the new key)
 *
 * Idempotent: re-running finds nothing to do.
 *
 *   npx tsx --env-file=.env.local scripts/rename-spider-crab.ts            # dry run
 *   npx tsx --env-file=.env.local scripts/rename-spider-crab.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { normalizeForMatch } from "../src/lib/normalize-answer";

const prisma = new PrismaClient();

const OLD_SCI = "Hyas araneus";
const NEW_SCI = "Majoidea";
const OLD_COMMON = "Great Spider Crab";
const NEW_COMMON = "Spider Crab";

const APPLY = process.argv.includes("--apply");

async function main() {
  const plan: string[] = [];

  const images = await prisma.speciesImage.count({ where: { scientificName: OLD_SCI } });
  const marks = await prisma.diagnosticMark.count({ where: { scientificName: OLD_SCI } });
  const unlocked = await prisma.unlockedSpecies.findMany({ where: { scientificName: OLD_SCI } });
  const answers = await prisma.answer.count({ where: { chosenOption: OLD_COMMON } });
  const snippets = await prisma.snippet.count({ where: { staffAnswer: OLD_COMMON } });
  const consensus = await prisma.consensusEvent.findMany({
    where: { normalisedName: normalizeForMatch(OLD_COMMON) },
  });
  const depth = await prisma.speciesDepthCache.count({ where: { scientificName: OLD_SCI } });
  const dist = await prisma.speciesDistributionCache.count({ where: { scientificName: OLD_SCI } });

  plan.push(`SpeciesImage           ${images}`);
  plan.push(`DiagnosticMark         ${marks}`);
  plan.push(`UnlockedSpecies        ${unlocked.length}`);
  plan.push(`Answer.chosenOption    ${answers}`);
  plan.push(`Snippet.staffAnswer    ${snippets}`);
  plan.push(`ConsensusEvent         ${consensus.length}`);
  plan.push(`SpeciesDepthCache      ${depth} (delete)`);
  plan.push(`SpeciesDistribution    ${dist} (delete)`);
  console.log(`${OLD_SCI} / "${OLD_COMMON}"  ->  ${NEW_SCI} / "${NEW_COMMON}"`);
  console.log(plan.map((l) => `  ${l}`).join("\n"));

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to write.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.speciesImage.updateMany({
      where: { scientificName: OLD_SCI },
      data: { scientificName: NEW_SCI },
    });
    await tx.diagnosticMark.updateMany({
      where: { scientificName: OLD_SCI },
      data: { scientificName: NEW_SCI },
    });

    // (userId, scientificName) is unique: a user who somehow already holds the
    // new key keeps it and the stale row is dropped rather than colliding.
    const already = new Set(
      (
        await tx.unlockedSpecies.findMany({
          where: { scientificName: NEW_SCI },
          select: { userId: true },
        })
      ).map((r) => r.userId),
    );
    for (const row of unlocked) {
      if (already.has(row.userId)) {
        await tx.unlockedSpecies.delete({ where: { id: row.id } });
      } else {
        await tx.unlockedSpecies.update({
          where: { id: row.id },
          data: { scientificName: NEW_SCI },
        });
      }
    }

    await tx.answer.updateMany({
      where: { chosenOption: OLD_COMMON },
      data: { chosenOption: NEW_COMMON },
    });
    await tx.snippet.updateMany({
      where: { staffAnswer: OLD_COMMON },
      data: { staffAnswer: NEW_COMMON },
    });

    // (snippetId, normalisedName) is unique: merge into an existing event for
    // the new label if one exists, otherwise just re-point.
    for (const ev of consensus) {
      const existing = await tx.consensusEvent.findUnique({
        where: {
          snippetId_normalisedName: {
            snippetId: ev.snippetId,
            normalisedName: normalizeForMatch(NEW_COMMON),
          },
        },
      });
      if (existing) {
        await tx.consensusEvent.update({
          where: { id: existing.id },
          data: {
            creditedAnswerIds: Array.from(
              new Set([...existing.creditedAnswerIds, ...ev.creditedAnswerIds]),
            ),
          },
        });
        await tx.consensusEvent.delete({ where: { id: ev.id } });
      } else {
        await tx.consensusEvent.update({
          where: { id: ev.id },
          data: { normalisedName: normalizeForMatch(NEW_COMMON) },
        });
      }
    }

    await tx.speciesDepthCache.deleteMany({ where: { scientificName: OLD_SCI } });
    await tx.speciesDistributionCache.deleteMany({ where: { scientificName: OLD_SCI } });
  });

  console.log("\nApplied.");
  console.log(`  SpeciesImage now: ${await prisma.speciesImage.count({ where: { scientificName: NEW_SCI } })}`);
  console.log(`  DiagnosticMark now: ${await prisma.diagnosticMark.count({ where: { scientificName: NEW_SCI } })}`);
  console.log(`  Answers now: ${await prisma.answer.count({ where: { chosenOption: NEW_COMMON } })}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
