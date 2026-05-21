/**
 * GET /api/snippets/[id]/bbox — lazy bbox payload (S4-11/12).
 *
 * The /feed initial payload omits Snippet.bboxJson; the FeedPlayer
 * fetches per-card bbox here only when the card enters the ±1
 * window. Keeps the /feed HTML small enough that LCP stays under
 * 2.5s as the corpus grows.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const snippet = await prisma.snippet.findUnique({
    where: { id },
    select: { bboxJson: true },
  });
  if (!snippet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Parse + re-serialise: the column stores a JSON string but
  // returning structured JSON saves the client a JSON.parse.
  let bboxes: unknown = null;
  if (snippet.bboxJson) {
    try {
      bboxes = JSON.parse(snippet.bboxJson);
    } catch {
      bboxes = null;
    }
  }
  return NextResponse.json(
    { bboxes },
    {
      headers: {
        // Stable per snippet; cache modestly to absorb the ±1 preload
        // pattern (FeedPlayer requests this for every card it enters).
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    },
  );
}
