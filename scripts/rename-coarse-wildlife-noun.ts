/**
 * One-off migration: the coarse commit noun for the `other` shape class,
 * "bird or mammal" -> "bird or seal".
 *
 * The class holds three birds and two seals (no other mammal), so the gate's
 * "Birds & Mammals" tile was renamed "Birds & seals" on 30 Aug 2026 to match
 * the species guide. SHAPE_CLASS_COMMIT_NOUN is not just a label: FeedCard
 * submits it VERBATIM as Answer.chosenOption when a spotter taps
 * "It's just a bird or mammal", so the rename splits the answer text in two
 * unless the existing rows come with it.
 *
 * That matters because consensus grouping is strict normalised equality
 * (src/lib/consensus.ts). Prod holds 2 answers on the shag clip at Pabay,
 * from 2 distinct users, one short of CONSENSUS_THRESHOLD_USERS. Leave them
 * behind and a third spotter tapping the same tile starts a SECOND camp that
 * can never reach threshold, while the first is stranded at two forever.
 *
 * Touched:
 *   Answer.chosenOption           "bird or mammal" -> "bird or seal"
 *   Snippet.staffAnswer           same rename (none in prod, covered anyway)
 *   ConsensusEvent.normalisedName re-normalised (none in prod, merge-safe)
 *
 * Idempotent: re-running finds nothing to do.
 *
 *   npx tsx --env-file=.env.local scripts/rename-coarse-wildlife-noun.ts            # dry run
 *   npx tsx --env-file=.env.local scripts/rename-coarse-wildlife-noun.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { normalizeForMatch } from "../src/lib/normalize-answer";

const prisma = new PrismaClient();

const OLD_NOUN = "bird or mammal";
const NEW_NOUN = "bird or seal";

const APPLY = process.argv.includes("--apply");

async function main() {
  const answers = await prisma.answer.count({ where: { chosenOption: OLD_NOUN } });
  const snippets = await prisma.snippet.count({ where: { staffAnswer: OLD_NOUN } });
  const consensus = await prisma.consensusEvent.findMany({
    where: { normalisedName: normalizeForMatch(OLD_NOUN) },
  });

  console.log(`"${OLD_NOUN}"  ->  "${NEW_NOUN}"`);
  console.log(`  Answer.chosenOption    ${answers}`);
  console.log(`  Snippet.staffAnswer    ${snippets}`);
  console.log(`  ConsensusEvent         ${consensus.length}`);

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to write.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.answer.updateMany({
      where: { chosenOption: OLD_NOUN },
      data: { chosenOption: NEW_NOUN },
    });
    await tx.snippet.updateMany({
      where: { staffAnswer: OLD_NOUN },
      data: { staffAnswer: NEW_NOUN },
    });

    // (snippetId, normalisedName) is unique: merge into an existing event for
    // the new noun if one exists, otherwise just re-point.
    for (const ev of consensus) {
      const existing = await tx.consensusEvent.findUnique({
        where: {
          snippetId_normalisedName: {
            snippetId: ev.snippetId,
            normalisedName: normalizeForMatch(NEW_NOUN),
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
          data: { normalisedName: normalizeForMatch(NEW_NOUN) },
        });
      }
    }
  });

  console.log("\nApplied.");
  console.log(`  Answers now on "${NEW_NOUN}": ${await prisma.answer.count({ where: { chosenOption: NEW_NOUN } })}`);
  console.log(`  Answers left on "${OLD_NOUN}": ${await prisma.answer.count({ where: { chosenOption: OLD_NOUN } })}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
