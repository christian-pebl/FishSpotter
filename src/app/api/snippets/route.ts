import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { excludeBlockedSnippetsWhere } from "@/lib/snippet-blocklist";
import { PUBLIC_SNIPPET_LIST_SELECT, SNIPPET_API_HEADERS } from "@/lib/snippet-public";

export const dynamic = "force-dynamic";

/**
 * GET /api/snippets: the live clips, newest first.
 *
 * Public callers get where and when each clip was filmed and nothing that
 * names it (see @/lib/snippet-public for why). PEBL staff also get the export
 * folder name and the media URLs, the shape this route returned to everyone
 * before 12 Nov 2026.
 */
export async function GET() {
  const admin = await getAdminSession();

  const snippets = await prisma.snippet.findMany({
    where: excludeBlockedSnippetsWhere(),
    orderBy: { createdAt: "desc" },
    select: admin
      ? {
          ...PUBLIC_SNIPPET_LIST_SELECT,
          externalId: true,
          thumbnailUrl: true,
          videoUrl: true,
        }
      : PUBLIC_SNIPPET_LIST_SELECT,
  });
  return NextResponse.json(snippets, { headers: SNIPPET_API_HEADERS });
}
