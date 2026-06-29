/**
 * GET /api/feed?cursor=&take= — feed pagination endpoint (S4-11).
 *
 * The /feed page renders the first ~5 snippets server-side; this
 * endpoint hands the rest in batches. The cursor is the `id` of the
 * last snippet on the current page; ordering is `createdAt desc`.
 *
 * Importantly, `bboxJson` is NOT included in the response. The /feed
 * page's initial payload also omits it; the FeedPlayer fetches per-
 * card bbox via `/api/snippets/[id]/bbox` only when the card enters
 * the ±1 window. Keeps the /feed HTML small.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { excludeBlockedSnippetsWhere } from "@/lib/snippet-blocklist";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  cursor: z.string().min(1).max(64).optional(),
  take: z.coerce.number().int().min(1).max(20).optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    take: url.searchParams.get("take") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const take = parsed.data.take ?? 8;
  const cursor = parsed.data.cursor;

  const snippets = await prisma.snippet.findMany({
    where: excludeBlockedSnippetsWhere(),
    orderBy: { createdAt: "desc" },
    take,
    ...(cursor
      ? { cursor: { id: cursor }, skip: 1 }
      : {}),
    select: {
      id: true,
      videoUrl: true,
      thumbnailUrl: true,
      site: true,
      deployment: true,
      staffAnswer: true,
      lat: true,
      lon: true,
      depthM: true,
      recordingDatetime: true,
    },
  });

  const nextCursor = snippets.length === take ? snippets[snippets.length - 1].id : null;
  return NextResponse.json({ snippets, nextCursor });
}
