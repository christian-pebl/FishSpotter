/**
 * GET /api/cron/new-clips. The new-clip alert cron (2026-08-13).
 *
 * Runs daily per vercel.json. Authorization: Bearer CRON_SECRET, same as every
 * other cron. For each spotter who opted in AND has a verified email, sends one
 * alert covering every feed-visible clip added since their own watermark, then
 * stamps the watermark so the next run starts from there.
 *
 * Sends nothing when nothing is new, which is the whole contract of this email:
 * it is not a schedule, it is an event. A spotter who opts in and then sees no
 * mail for two months has been served correctly.
 *
 * Verified email is required for the same reason the weekly digest requires it:
 * an unverified address was typed at signup and may belong to someone else, and
 * unsolicited mail to a stranger's inbox is exactly what PECR Reg. 22 is about.
 * The end-of-feed card surfaces a resend-verification path rather than silently
 * dropping such spotters.
 */

import { SITE_URL } from "@/lib/site-url";
import { NextResponse } from "next/server";
import { NewClipsEmail } from "@/lib/email/templates/NewClipsEmail";
import { newClipsUnsubscribeUrl } from "@/lib/email/unsubscribe";
import { sendEmail } from "@/lib/email/send";
import { isAuthorisedCron } from "@/lib/cron-auth";
import { excludeBlockedSnippetsWhere } from "@/lib/snippet-blocklist";
import { collectSiteNames, describeSites, MAX_SITES_LISTED } from "@/lib/new-clips";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PER_RUN_CAP = 200;

export async function GET(req: Request) {
  if (!isAuthorisedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const base = SITE_URL;

  // One query for the whole clip set rather than a per-recipient count: the
  // catalogue is small (97 rows, 73 of them feed-visible) and every recipient
  // is asking the same question against a different watermark, so slicing it
  // in memory beats N round-trips.
  const clips = await prisma.snippet.findMany({
    where: excludeBlockedSnippetsWhere(),
    select: { createdAt: true, site: true },
    orderBy: { createdAt: "desc" },
  });

  const recipients = await prisma.user.findMany({
    where: {
      newClipsOptIn: true,
      emailVerified: { not: null },
      isGuest: false,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      name: true,
      createdAt: true,
      lastNewClipsNotifiedAt: true,
    },
    take: PER_RUN_CAP,
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const u of recipients) {
    // Falls back to account creation, not epoch: a spotter who somehow reaches
    // the cron with no stamp must not be mailed the entire back catalogue.
    const since = u.lastNewClipsNotifiedAt ?? u.createdAt;
    const fresh = clips.filter((c) => c.createdAt > since);
    if (fresh.length === 0) {
      skipped++;
      continue;
    }
    const sites = collectSiteNames(fresh);
    try {
      await sendEmail({
        to: u.email,
        subject:
          fresh.length === 1
            ? "A new clip to identify on FishSpotter"
            : `${fresh.length} new clips to identify on FishSpotter`,
        react: NewClipsEmail({
          displayName: u.displayName ?? u.name ?? "Spotter",
          clipCount: fresh.length,
          sitesLabel: describeSites(sites, MAX_SITES_LISTED),
          feedUrl: `${base}/feed`,
          unsubscribeUrl: newClipsUnsubscribeUrl(u.id, base),
        }),
      });
      // Stamp only after a successful send, so a transient SendGrid failure
      // retries on the next run instead of silently swallowing the alert.
      await prisma.user.update({
        where: { id: u.id },
        data: { lastNewClipsNotifiedAt: new Date() },
      });
      sent++;
    } catch (err) {
      failed++;
      log.error("new-clip alert send failed", {
        context: "cron/new-clips",
        userId: u.id,
        err,
      });
    }
  }

  // Same alerting contract as the digest cron: surface any failure as a 500 so
  // Vercel's cron-failure alerting fires. A run where everyone was up to date
  // (sent 0, skipped N) is a healthy run, not a degraded one.
  if (failed > 0) {
    log.error("new-clips cron degraded", {
      context: "cron/new-clips",
      recipients: recipients.length,
      sent,
      skipped,
      failed,
    });
    return NextResponse.json(
      { ok: false, recipients: recipients.length, sent, skipped, failed },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    recipients: recipients.length,
    sent,
    skipped,
    failed,
  });
}
