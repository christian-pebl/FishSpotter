/**
 * POST /api/parent/manage, what a parent can do from the parent page.
 *
 * Body: { token, action, childId, purpose? }. The token is a manage link
 * (src/lib/parental-consent.ts). What it allows depends on the consent the
 * parent actually holds for that child, checked here every time:
 *
 *   child-signin      granted account consent: a one-time token the page
 *                     spends to sign THIS device in as the child.
 *   export            granted account consent: everything we hold on the
 *                     child, as JSON (COPPA: a parent may review it).
 *   delete-child      granted account consent: withdraw consent and delete
 *                     the child's account and everything attached to it.
 *   withdraw-prize    any prize consent this parent holds: remove it, so the
 *                     prize is not posted.
 *   decline-request   a request still waiting (either purpose): say no, which
 *                     deletes it and the parent's address.
 *
 * A parent who only agreed to a prize (a 13 to 17 year old's) cannot sign in
 * as, export or delete the teenager's own account from here.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { clientIpKey } from "@/lib/client-ip";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import {
  PARENTAL_CONSENT_PURPOSES,
  createChildSignInToken,
  declineConsent,
  deleteChildAccount,
  findParentConsent,
  resolveManageToken,
  withdrawPrizeConsent,
} from "@/lib/parental-consent";

export const dynamic = "force-dynamic";

const Schema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/),
  action: z.enum(["child-signin", "export", "delete-child", "withdraw-prize", "decline-request"]),
  childId: z.string().min(1).max(64),
  purpose: z.enum(PARENTAL_CONSENT_PURPOSES).optional(),
});

const EXPIRED = () =>
  NextResponse.json(
    { error: "This link has expired. Ask for a new one on the parent page.", code: "expired" },
    { status: 401 },
  );

const NOT_ALLOWED = () =>
  NextResponse.json(
    { error: "That isn't available for this account.", code: "not-allowed" },
    { status: 403 },
  );

export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }
  let parsed;
  try {
    parsed = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!(await checkAuthRateLimit(`parent-manage:${clientIpKey(req)}:${parsed.action}`))) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  }

  const now = new Date();
  const parentEmail = await resolveManageToken(prisma, parsed.token, now);
  if (!parentEmail) return EXPIRED();

  const { action, childId } = parsed;

  if (action === "withdraw-prize") {
    const removed = await withdrawPrizeConsent(prisma, parentEmail, childId);
    return removed ? NextResponse.json({ ok: true }) : NOT_ALLOWED();
  }

  if (action === "decline-request") {
    if (!parsed.purpose) return NOT_ALLOWED();
    const consent = await findParentConsent(prisma, parentEmail, childId, parsed.purpose);
    if (!consent || consent.status !== "pending") return NOT_ALLOWED();
    await declineConsent(prisma, consent.id);
    return NextResponse.json({ ok: true });
  }

  // Everything below needs a granted account consent.
  const account = await findParentConsent(prisma, parentEmail, childId, "account");
  if (!account || account.status !== "granted") return NOT_ALLOWED();

  if (action === "child-signin") {
    const signInToken = await createChildSignInToken(prisma, parentEmail, childId, now);
    if (!signInToken) return NOT_ALLOWED();
    return NextResponse.json({ ok: true, signInToken });
  }

  if (action === "delete-child") {
    await deleteChildAccount(prisma, childId);
    // eslint-disable-next-line no-console
    console.log(`[coppa] child account ${childId} deleted by parent at ${now.toISOString()}`);
    return NextResponse.json({ ok: true });
  }

  // export
  const child = await prisma.user.findUnique({
    where: { id: childId },
    select: {
      displayName: true,
      ageBracket: true,
      ageDeclaredAt: true,
      createdAt: true,
      leaderboardOptIn: true,
      answers: {
        select: {
          chosenOption: true,
          points: true,
          isCorrect: true,
          createdAt: true,
          snippet: { select: { externalId: true, site: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      parentalConsents: {
        select: { purpose: true, status: true, requestedAt: true, grantedAt: true },
      },
    },
  });
  if (!child) return NOT_ALLOWED();

  const payload = {
    exportedAt: now.toISOString(),
    service: "PEBL FishSpotter (fishspotter.app)",
    note:
      "Everything PEBL FishSpotter holds about this child. Their own email address, name and location are never collected.",
    account: {
      nickname: child.displayName,
      ageBand: child.ageBracket,
      ageDeclaredAt: child.ageDeclaredAt,
      joinedAt: child.createdAt,
      shownOnPublicLeaderboard: false,
    },
    parentalConsents: child.parentalConsents,
    identifications: child.answers.map((a) => ({
      clip: a.snippet.externalId,
      site: a.snippet.site,
      answer: a.chosenOption,
      pebbles: a.points,
      agreedWithCommunity: a.isCorrect,
      at: a.createdAt,
    })),
  };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
