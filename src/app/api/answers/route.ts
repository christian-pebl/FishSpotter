import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_OPTIONS = ["Fish", "Crab", "Jellyfish", "Flatfish", "Gastropod", "Scooter", "Other"];

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { snippetId, chosenOption, freeText } = body as {
    snippetId?: string;
    chosenOption?: string;
    freeText?: string;
  };

  if (!snippetId || !chosenOption) {
    return NextResponse.json(
      { error: "snippetId and chosenOption required" },
      { status: 400 }
    );
  }

  const option = chosenOption.trim();
  if (!VALID_OPTIONS.includes(option) && option !== "Other") {
    return NextResponse.json(
      { error: "Invalid chosenOption" },
      { status: 400 }
    );
  }

  const snippet = await prisma.snippet.findUnique({
    where: { id: snippetId },
    select: { id: true, staffAnswer: true },
  });
  if (!snippet) {
    return NextResponse.json({ error: "Snippet not found" }, { status: 404 });
  }

  const isCorrect = snippet.staffAnswer.toLowerCase() === option.toLowerCase();

  const answer = await prisma.answer.upsert({
    where: {
      userId_snippetId: {
        userId: session.user.id,
        snippetId,
      },
    },
    create: {
      userId: session.user.id,
      snippetId,
      chosenOption: option,
      freeText: option === "Other" ? (freeText ?? null) : null,
      isCorrect,
    },
    update: {
      chosenOption: option,
      freeText: option === "Other" ? (freeText ?? null) : null,
      isCorrect,
    },
  });

  return NextResponse.json({ answer, isCorrect });
}
