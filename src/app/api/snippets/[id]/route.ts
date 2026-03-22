import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const snippet = await prisma.snippet.findUnique({
    where: { id },
  });
  if (!snippet) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { bboxJson, ...rest } = snippet;
  return NextResponse.json({
    ...rest,
    bboxes: bboxJson ? JSON.parse(bboxJson) : null,
  });
}
