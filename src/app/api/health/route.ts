import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isEmailConfigured } from "@/lib/email/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/health: 200 when the database answers, 503 when it does not.
 *
 * `email` reports whether the transactional sender has its two env vars
 * (SENDGRID_API_KEY, EMAIL_FROM_ADDRESS), so one curl from anywhere can catch
 * a deployment that silently sends nothing, the failure behind the 8 Sep 2026
 * "I never get the verification email" message. It is a config check only: it
 * cannot see whether SendGrid accepts mail from the sender. The test send on
 * /admin/email answers that. Deliberately not part of `ok`: an uptime monitor
 * paging at 3am because a key was rotated is the wrong severity.
 */
export async function GET() {
  const ts = new Date().toISOString();
  const email = isEmailConfigured() ? "configured" : "unconfigured";

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { ok: true, db: "up", email, ts },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, db: "down", email, ts },
      { status: 503 }
    );
  }
}
