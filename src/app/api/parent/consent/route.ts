/**
 * POST /api/parent/consent, a parent answers a request from the emailed link.
 *
 * Body: { token, decision: "grant" | "decline", confirmParent?, ukAddress? }
 *
 * Agreeing needs the parent to confirm they are the child's parent or carer
 * and an adult, and, for the prize, that the book can go to a UK address.
 * Saying no deletes the request and the parent's address with it.
 *
 * On agreement the response hands back a short-lived manage token so the
 * parent can carry straight on to the parent page from the same tab. The
 * confirmation email (the second step of "email plus") follows a day later
 * from the child-data-retention cron, repeating the notice with a link to
 * review, delete or withdraw.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { clientIpKey } from "@/lib/client-ip";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import {
  createManageToken,
  declineConsent,
  findPendingConsentByToken,
  grantConsent,
} from "@/lib/parental-consent";

export const dynamic = "force-dynamic";

const Schema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/),
  decision: z.enum(["grant", "decline"]),
  confirmParent: z.boolean().optional(),
  ukAddress: z.boolean().optional(),
});

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
  if (!(await checkAuthRateLimit(`parent-consent:${clientIpKey(req)}`))) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  }

  const now = new Date();
  const pending = await findPendingConsentByToken(prisma, parsed.token, now);
  if (!pending) {
    return NextResponse.json(
      {
        error:
          "This link has expired or has already been used. Ask your child to send a new request.",
        code: "expired",
      },
      { status: 410 },
    );
  }

  if (parsed.decision === "decline") {
    await declineConsent(prisma, pending.id);
    return NextResponse.json({ ok: true, decision: "decline" });
  }

  if (parsed.confirmParent !== true) {
    return NextResponse.json(
      { error: "Please confirm you are this child's parent or carer.", code: "confirm-parent" },
      { status: 400 },
    );
  }
  if (pending.purpose === "prize" && parsed.ukAddress !== true) {
    return NextResponse.json(
      { error: "We can only post the prize to a UK address.", code: "uk-address" },
      { status: 400 },
    );
  }

  await grantConsent(
    prisma,
    pending.id,
    { ukAddressConfirmed: pending.purpose === "prize" && parsed.ukAddress === true },
    now,
  );

  const manageToken = await createManageToken(prisma, pending.parentEmail, now);

  return NextResponse.json({
    ok: true,
    decision: "grant",
    purpose: pending.purpose,
    manageToken,
  });
}
