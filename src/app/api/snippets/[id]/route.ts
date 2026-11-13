import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { excludeBlockedSnippetsWhere } from "@/lib/snippet-blocklist";
import { PUBLIC_SNIPPET_SELECT, SNIPPET_API_HEADERS } from "@/lib/snippet-public";

export const dynamic = "force-dynamic";

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * GET /api/snippets/[id]: one clip.
 *
 * Public callers get where and when it was filmed. Until 12 Nov 2026 this
 * returned the whole database row to anyone: the export folder name, the media
 * URLs built from it, and `staffAnswer`, the label the clip was exported
 * under. See @/lib/snippet-public. The player's tracking overlay comes from
 * the sibling `bbox` route, so nothing here was needed to play a clip.
 *
 * A hidden clip (excluded in TRDesk4, or on the blocklist) is a 404 for the
 * public, as it is everywhere else. PEBL staff get the full row for any clip.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = await getAdminSession();

  if (!admin) {
    const snippet = await prisma.snippet.findFirst({
      where: { id, ...excludeBlockedSnippetsWhere() },
      select: PUBLIC_SNIPPET_SELECT,
    });
    if (!snippet) {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: SNIPPET_API_HEADERS });
    }
    return NextResponse.json(snippet, { headers: SNIPPET_API_HEADERS });
  }

  const snippet = await prisma.snippet.findUnique({ where: { id } });
  if (!snippet) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: SNIPPET_API_HEADERS });
  }
  const { bboxJson, manualTrackJson, ...rest } = snippet;
  return NextResponse.json(
    { ...rest, bboxes: parseJson(bboxJson), manualTrack: parseJson(manualTrackJson) },
    { headers: SNIPPET_API_HEADERS },
  );
}
