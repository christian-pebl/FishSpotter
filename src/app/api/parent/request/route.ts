/**
 * POST /api/parent/request, a child spotter asks a parent or carer for their OK.
 *
 * Body: { purpose: "account" | "prize", parentEmail?: string }
 *   account  under-13s only: save their progress.
 *   prize    anyone under 18: have the prize posted. An under-13 whose account
 *            a parent already agreed to may leave parentEmail out, and the
 *            request goes to that same grown-up. The child never sees the
 *            address.
 *
 * The parent's address is the only thing collected here, and only to ask
 * (COPPA 312.5(c)(1)). The response says whether the email actually left,
 * so the child is never told "we've emailed them" for a message that did not
 * go.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { clientIpKey } from "@/lib/client-ip";
import { checkAuthRateLimit, checkParentRequestRateLimit } from "@/lib/rate-limit";
import { isAdminEmail } from "@/lib/admin-email";
import { isPlaceholderEmail } from "@/lib/age";
import {
  PARENTAL_CONSENT_PURPOSES,
  accountConsentParentEmail,
  createConsentRequest,
  normaliseParentEmail,
  purposeAllowedFor,
} from "@/lib/parental-consent";
import { sendParentConsentRequest, parentConsentUrl } from "@/lib/email/parent-dispatch";
import { sendOutcome, wasSent } from "@/lib/email/outcome";

export const dynamic = "force-dynamic";

const Schema = z.object({
  purpose: z.enum(PARENTAL_CONSENT_PURPOSES),
  parentEmail: z.string().email().max(254).optional(),
});

export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }
  const session = await getServerSession(authOptions);
  const childId = session?.user?.id;
  if (!childId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let parsed;
  try {
    parsed = Schema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Enter your grown-up's email address." },
      { status: 400 },
    );
  }

  const ip = clientIpKey(req);
  if (
    !(await checkAuthRateLimit(`parent-request:${ip}`)) ||
    !(await checkParentRequestRateLimit(childId))
  ) {
    return NextResponse.json(
      { error: "We've sent enough emails for today. Try again tomorrow." },
      { status: 429 },
    );
  }

  const child = await prisma.user.findUnique({
    where: { id: childId },
    select: { id: true, displayName: true, name: true, ageBracket: true, email: true },
  });
  if (!child) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }
  if (!purposeAllowedFor(parsed.purpose, child.ageBracket)) {
    return NextResponse.json(
      { error: "This account doesn't need a grown-up's OK for that.", code: "not-needed" },
      { status: 400 },
    );
  }

  let parentEmail = parsed.parentEmail ? normaliseParentEmail(parsed.parentEmail) : null;
  if (!parentEmail && parsed.purpose === "prize") {
    parentEmail = await accountConsentParentEmail(prisma, childId);
  }
  if (!parentEmail) {
    return NextResponse.json(
      { error: "Enter your grown-up's email address.", code: "email-required" },
      { status: 400 },
    );
  }
  // A child cannot be their own parent: refuse the account's own address, and
  // never let a staff address receive a consent link on a child's say-so.
  if (
    (!isPlaceholderEmail(child.email) && normaliseParentEmail(child.email) === parentEmail) ||
    isAdminEmail(parentEmail)
  ) {
    return NextResponse.json(
      { error: "That needs to be your parent or carer's own email address.", code: "bad-parent" },
      { status: 400 },
    );
  }

  const now = new Date();
  const result = await createConsentRequest(
    prisma,
    { childId, purpose: parsed.purpose, parentEmail },
    now,
  );
  if (result.kind === "already-granted") {
    return NextResponse.json({ ok: true, alreadyGranted: true, emailSent: false });
  }

  const childName = child.displayName ?? child.name ?? "A young spotter";
  const delivery = await sendParentConsentRequest({
    to: parentEmail,
    childName,
    purpose: parsed.purpose,
    plainToken: result.plainToken,
  });
  const emailSent = wasSent(delivery);
  if (!emailSent) {
    // eslint-disable-next-line no-console
    console.error("[parent/request] consent email not delivered", {
      childId,
      purpose: parsed.purpose,
      outcome: sendOutcome(delivery),
    });
    // Local development has no mail provider; print the link so the flow can
    // be walked by hand. Never in production, where a link is a credential.
    if (process.env.NODE_ENV !== "production" && delivery.skipped) {
      // eslint-disable-next-line no-console
      console.info(`[dev] parent consent link: ${parentConsentUrl(result.plainToken)}`);
    }
  }
  return NextResponse.json({ ok: true, emailSent });
}
