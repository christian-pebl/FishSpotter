import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const ts = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { ok: true, db: "up", ts },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, db: "down", ts },
      { status: 503 }
    );
  }
}
