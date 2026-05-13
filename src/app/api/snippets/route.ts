import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const snippets = await prisma.snippet.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      externalId: true,
      thumbnailUrl: true,
      videoUrl: true,
      site: true,
      deployment: true,
      recordingDatetime: true,
    },
  });
  return NextResponse.json(snippets);
}
