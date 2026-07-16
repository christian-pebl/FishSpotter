import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ answers: [] });
  }

  const { searchParams } = new URL(req.url);
  const snippetId = searchParams.get("snippetId");
  if (snippetId) {
    const one = await prisma.answer.findUnique({
      where: {
        userId_snippetId: { userId: session.user.id, snippetId },
      },
    });
    return NextResponse.json(one ? { answer: one } : { answer: null });
  }

  const answers = await prisma.answer.findMany({
    where: { userId: session.user.id },
    select: {
      snippetId: true,
      chosenOption: true,
      isCorrect: true,
      points: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ answers });
}
