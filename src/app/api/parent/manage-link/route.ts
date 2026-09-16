/**
 * POST /api/parent/manage-link, a parent asks for a link to the parent page.
 *
 * Always answers the same way, whether or not the address is linked to a
 * child, so this cannot be used to find out who is a parent here.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { clientIpKey } from "@/lib/client-ip";
import { checkAuthRateLimit, checkParentLinkRateLimit } from "@/lib/rate-limit";
import { createManageToken, normaliseParentEmail } from "@/lib/parental-consent";
import { parentManageUrl, sendParentManageLink } from "@/lib/email/parent-dispatch";
import { sendOutcome, wasSent } from "@/lib/email/outcome";

export const dynamic = "force-dynamic";

const Schema = z.object({ email: z.string().email().max(254) });

const SAME_ANSWER = {
  ok: true,
  message:
    "If that address is linked to a child's FishSpotter account, we've emailed it a link. It works for 1 hour.",
};

export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }
  let parsed;
  try {
    parsed = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const email = normaliseParentEmail(parsed.email);
  if (
    !(await checkAuthRateLimit(`parent-link:${clientIpKey(req)}`)) ||
    !(await checkParentLinkRateLimit(email))
  ) {
    return NextResponse.json(
      { error: "Too many requests. Try again in an hour." },
      { status: 429 },
    );
  }

  const token = await createManageToken(prisma, email, new Date());
  if (token) {
    const delivery = await sendParentManageLink({ to: email, manageToken: token });
    if (!wasSent(delivery)) {
      // eslint-disable-next-line no-console
      console.error("[parent/manage-link] email not delivered", { outcome: sendOutcome(delivery) });
      if (process.env.NODE_ENV !== "production" && delivery.skipped) {
        // eslint-disable-next-line no-console
        console.info(`[dev] parent manage link: ${parentManageUrl(token)}`);
      }
    }
  }
  return NextResponse.json(SAME_ANSWER);
}
