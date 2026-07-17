import { NextResponse } from "next/server";
import { z } from "zod";
import { immediateAward } from "@/lib/pebbles";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/csrf";
import { clientIpKey } from "@/lib/client-ip";
import { checkPreviewRateLimit } from "@/lib/rate-limit";
import { bucketAnswersByNormalized } from "@/lib/answer-histogram";
import { consensusSummary } from "@/lib/consensus";

// P0 "play before the wall": a public, READ-ONLY reveal so a signed-out spotter
// sees the community split (and the Pebbles they'd earn) before being asked to
// make an account. It mirrors POST /api/answers but writes nothing — no Answer
// row, no streak, no userId. The persisted path (which feeds the leaderboard /
// consensus / anti-spam) still requires auth, so nothing here can corrupt the
// dataset.
//
// Sea-currency redesign: there is no PEBL reference verdict — the crowd is the
// authority. The reveal shows the community histogram (gated behind the guess,
// so the submission stays blind) and the consensus state; there is no
// correct/wrong grade.

const MAX_ANSWER_LENGTH = 80;

const PreviewSchema = z.object({
  snippetId: z.string().min(1).max(64),
  chosenOption: z.string().min(1).max(MAX_ANSWER_LENGTH),
});

export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  if (!(await checkPreviewRateLimit(clientIpKey(req)))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let parsed;
  try {
    parsed = PreviewSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const option = parsed.chosenOption.trim();
  if (option.length === 0) {
    return NextResponse.json({ error: "Answer required" }, { status: 400 });
  }

  const snippet = await prisma.snippet.findUnique({
    where: { id: parsed.snippetId },
    select: { id: true },
  });
  if (!snippet) {
    return NextResponse.json({ error: "Snippet not found" }, { status: 404 });
  }

  // Community histogram — identical aggregation to GET /api/snippets/[id]/stats
  // so the reveal's distribution matches the authed experience.
  const answers = await prisma.answer.findMany({
    where: { snippetId: snippet.id },
    select: { chosenOption: true, isCorrect: true },
  });
  const total = answers.length;
  const stats = bucketAnswersByNormalized(answers)
    .map(({ option: opt, count }) => ({
      option: opt,
      count,
      percent: total ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Preview of the Pebbles a guest would earn on this clip (base + the
  // First-Sighting / early-spotter bonus for their would-be arrival order).
  const preview = immediateAward(total);

  return NextResponse.json({
    isCorrect: null,
    points: 0,
    chosenOption: option,
    total,
    stats,
    staffAnswer: null,
    hasReference: false,
    pebbles: { earned: preview.pebbles, firstSighting: preview.firstSighting },
    consensus: consensusSummary(stats, total),
  });
}
