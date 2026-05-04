import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_ANSWER_LENGTH = 80;

function normalizeAnswer(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(a|an|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  return previous[b.length];
}

function tokenOverlapScore(a: string, b: string) {
  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }
  return overlap / Math.max(aTokens.size, bTokens.size);
}

function similarityScore(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const distanceScore = 1 - levenshteinDistance(a, b) / Math.max(a.length, b.length);
  const overlapScore = tokenOverlapScore(a, b);
  const shortest = Math.min(a.length, b.length);
  const containmentScore = shortest >= 4 && (a.includes(b) || b.includes(a)) ? 0.84 : 0;
  return Math.max(distanceScore, distanceScore * 0.75 + overlapScore * 0.25, containmentScore);
}

function suggestionThreshold(answerLength: number) {
  if (answerLength <= 4) return 0.75;
  if (answerLength <= 8) return 0.72;
  return 0.68;
}

function getCorrectionSuggestion(answer: string, candidates: string[]) {
  const normalizedAnswer = normalizeAnswer(answer);
  if (normalizedAnswer.length < 3) return null;

  let best: { label: string; score: number } | null = null;
  for (const label of candidates) {
    const normalizedLabel = normalizeAnswer(label);
    if (!normalizedLabel || normalizedLabel === normalizedAnswer) continue;
    const score = similarityScore(normalizedAnswer, normalizedLabel);
    if (!best || score > best.score) best = { label, score };
  }

  if (!best) return null;
  return best.score >= suggestionThreshold(normalizedAnswer.length) ? best.label : null;
}

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
    return NextResponse.json(
      { error: "snippetId and chosenOption required" },
      { status: 400 }
    );
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
    select: { id: true, staffAnswer: true },
  });
  if (!snippet) {
    return NextResponse.json({ error: "Snippet not found" }, { status: 404 });
  }

  const normalizedOption = normalizeAnswer(option);
  const normalizedStaffAnswer = normalizeAnswer(snippet.staffAnswer);
  const isCorrect = normalizedStaffAnswer === normalizedOption;

  if (!isCorrect && !skipCorrection) {
    const referenceRows = await prisma.snippet.findMany({
      select: { staffAnswer: true },
    });
    const referenceAnswers = Array.from(new Set(referenceRows.map((row) => row.staffAnswer)));
    const suggestion = getCorrectionSuggestion(option, referenceAnswers);

    if (suggestion) {
      return NextResponse.json({
        correction: {
          original: option,
          suggestion,
        },
      });
    }
  }

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
      freeText: null,
      isCorrect,
    },
    update: {
      chosenOption: option,
      freeText: null,
      isCorrect,
    },
  });

  return NextResponse.json({ answer, isCorrect });
}
