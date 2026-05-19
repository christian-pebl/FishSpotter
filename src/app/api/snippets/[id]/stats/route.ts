import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
  const byOption: Record<string, number> = {};
  for (const a of answers) {
    byOption[a.chosenOption] = (byOption[a.chosenOption] ?? 0) + 1;
  }
  const stats = Object.entries(byOption).map(([option, count]) => ({
    option,
    count,
    percent: total ? Math.round((count / total) * 100) : 0,
  })).sort((a, b) => b.count - a.count);

  return NextResponse.json({
    total,
    stats,
    ...(userHasAnswered ? { staffAnswer: snippet.staffAnswer } : {}),
  });
}
