import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAnswerToTaxon } from "@/lib/taxon-matching";

const MAX_ANSWER_LENGTH = 80;

const POINTS = {
  CORRECT_VERIFIED: 10,
  WRONG_VERIFIED: 1,
  CONTRIBUTED_UNLABELLED: 5,
} as const;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { snippetId, chosenOption, skipCorrection } = body as {
    snippetId?: string;
    chosenOption?: string;
    skipCorrection?: boolean;
  };

  if (!snippetId || !chosenOption) {
    return NextResponse.json({ error: "snippetId and chosenOption required" }, { status: 400 });
  }

  const option = chosenOption.trim();
  if (option.length === 0 || option.length > MAX_ANSWER_LENGTH) {
    return NextResponse.json(
      { error: `Answer must be between 1 and ${MAX_ANSWER_LENGTH} characters` },
      { status: 400 }
    );
  }

  const snippet = await prisma.snippet.findUnique({
    where: { id: snippetId },
    select: { id: true, staffTaxonId: true, labelStatus: true, staffAnswer: true },
  });
  if (!snippet) {
    return NextResponse.json({ error: "Snippet not found" }, { status: 404 });
  }

  // Resolve user's input to a Taxon
  const resolution = await resolveAnswerToTaxon(option);

  // If we have a low-confidence suggestion, offer the correction unless caller skipped it
  if (resolution.kind === "suggestion" && !skipCorrection) {
    return NextResponse.json({
      correction: { original: resolution.original, suggestion: resolution.suggestion },
    });
  }

  // Determine outcome + points
  let resolvedTaxonId: string | null = null;
  let outcome: "correct" | "wrong" | "contributed" | "unrecognised" = "unrecognised";
  let pointsAwarded = 0;

  if (resolution.kind === "exact") {
    resolvedTaxonId = resolution.taxonId;
    if (snippet.labelStatus === "STAFF_LABELLED") {
      if (resolution.taxonId === snippet.staffTaxonId) {
        outcome = "correct";
        pointsAwarded = POINTS.CORRECT_VERIFIED;
      } else {
        outcome = "wrong";
        pointsAwarded = POINTS.WRONG_VERIFIED;
      }
    } else {
      outcome = "contributed";
      pointsAwarded = POINTS.CONTRIBUTED_UNLABELLED;
    }
  } else {
    // unrecognised — but caller submitted with skipCorrection (no fuzzy match available)
    // We still record the answer so user gets contribution credit on UNLABELLED clips,
    // and effort credit (1 pt) on VERIFIED clips. resolvedTaxonId stays null.
    if (snippet.labelStatus === "STAFF_LABELLED") {
      outcome = "wrong";
      pointsAwarded = POINTS.WRONG_VERIFIED;
    } else {
      outcome = "contributed";
      pointsAwarded = POINTS.CONTRIBUTED_UNLABELLED;
    }
  }

  const isCorrect = outcome === "correct";

  const answer = await prisma.answer.upsert({
    where: { userId_snippetId: { userId: session.user.id, snippetId } },
    create: {
      userId: session.user.id,
      snippetId,
      chosenOption: option,
      freeText: null,
      isCorrect,
      taxonId: resolvedTaxonId,
      pointsAwarded,
    },
    update: {
      chosenOption: option,
      freeText: null,
      isCorrect,
      taxonId: resolvedTaxonId,
      pointsAwarded,
    },
  });

  // Fetch staff taxon details for the reveal panel (when STAFF_LABELLED)
  const staffTaxon = snippet.staffTaxonId
    ? await prisma.taxon.findUnique({
        where: { id: snippet.staffTaxonId },
        select: {
          id: true, name: true, scientificName: true,
          funFact: true, description: true, heroImageUrl: true, habitatNote: true,
          isFunctionalGroup: true,
        },
      })
    : null;

  // Fetch the resolved taxon (what the user said) — may be the same as staff or different
  const resolvedTaxon = resolvedTaxonId
    ? await prisma.taxon.findUnique({
        where: { id: resolvedTaxonId },
        select: {
          id: true, name: true, scientificName: true,
          funFact: true, description: true, heroImageUrl: true, habitatNote: true,
          isFunctionalGroup: true,
        },
      })
    : null;

  return NextResponse.json({
    answer,
    isCorrect,
    outcome,
    pointsAwarded,
    labelStatus: snippet.labelStatus,
    resolvedTaxon,
    staffTaxon,
  });
}
