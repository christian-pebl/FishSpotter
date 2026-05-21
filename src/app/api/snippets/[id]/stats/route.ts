import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizeAnswer } from "@/lib/normalize-answer";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Bucket community answers by the same normalised key everywhere
 * (S2-T02). Without this, "pollack", "Pollack", "  pollack ", and
 * "the pollack" land as four separate rows.
 *
 * For each normalised bucket, pick the canonical display surface:
 *   - If one of the surface forms normalises to the staff answer,
 *     use the staff answer as the canonical (so the histogram label
 *     matches what's correct).
 *   - Otherwise, the most-frequent surface form in the bucket wins.
 */
function bucketByNormalized(
  answers: { chosenOption: string }[],
  staffAnswer: string,
): Array<{ option: string; count: number }> {
  const normalizedStaff = normalizeAnswer(staffAnswer);
  const buckets = new Map<
    string,
    { count: number; surfaces: Map<string, number> }
  >();

  for (const a of answers) {
    const key = normalizeAnswer(a.chosenOption);
    if (!key) continue;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { count: 0, surfaces: new Map() };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    bucket.surfaces.set(
      a.chosenOption,
      (bucket.surfaces.get(a.chosenOption) ?? 0) + 1,
    );
  }

  const out: Array<{ option: string; count: number }> = [];
  for (const [key, bucket] of buckets) {
    let option: string;
    if (key === normalizedStaff) {
      option = staffAnswer;
    } else {
      // Highest-count surface form. Ties broken alphabetically so the
      // output is deterministic across requests.
      const sortedSurfaces = Array.from(bucket.surfaces.entries()).sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      );
      option = sortedSurfaces[0][0];
    }
    out.push({ option, count: bucket.count });
  }
  return out;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const snippet = await prisma.snippet.findUnique({
    where: { id },
    select: { id: true, staffAnswer: true },
  });
  if (!snippet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await getServerSession(authOptions);
  const userHasAnswered = !!(
    session?.user?.id &&
    (await prisma.answer.findFirst({
      where: { userId: session.user.id, snippetId: id },
      select: { id: true },
    }))
  );

  const answers = await prisma.answer.findMany({
    where: { snippetId: id },
    select: { chosenOption: true, isCorrect: true },
  });

  const total = answers.length;
  const stats = bucketByNormalized(answers, snippet.staffAnswer)
    .map(({ option, count }) => ({
      option,
      count,
      percent: total ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    total,
    stats,
    ...(userHasAnswered ? { staffAnswer: snippet.staffAnswer } : {}),
  });
}
