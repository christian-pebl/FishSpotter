import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const taxon = await prisma.taxon.findUnique({
    where: { id },
    include: {
      snippets: {
        select: { id: true, externalId: true, thumbnailUrl: true, site: true, recordingDatetime: true },
        orderBy: { createdAt: "desc" },
        take: 12,
      },
      aliases: { select: { display: true, source: true } },
    },
  });
  if (!taxon) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ taxon });
}
