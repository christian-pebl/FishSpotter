/**
 * The notice to accounts with school-like email addresses (16 Sep 2026).
 *
 * Ten accounts had saved their progress with US school addresses before
 * FishSpotter asked anyone's age (docs/compliance/children.md, section 10).
 * Christian decided to tell them, not delete silently: one email explaining
 * the new rules and that the address will be removed from the account on a
 * stated date. The address then goes on that UK calendar date, whatever age
 * they give in the meantime (an under-13 answer removes it at once anyway).
 * Progress stays. See purgeChildData for the removal.
 *
 * The admin sends the notice from /admin/children (preview first, one account
 * per request, re-decided on the server), in the same pattern as the
 * verification catch-up on /admin/email.
 */

import type { PrismaClient } from "@prisma/client";
import { isPlaceholderEmail } from "@/lib/age";

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long after the notice the address is removed (to the UK calendar day). */
export const AGE_NOTICE_GRACE_MS = 14 * DAY_MS;

/**
 * A lower bound on ageNoticeSentAt for accounts that could be due, for the
 * database query; isRemovalDue decides. Two days of slack covers the end of
 * a UK day (up to 25 hours away on the day the clocks go back).
 */
export function removalCandidateCutoff(now: Date): Date {
  return new Date(now.getTime() - AGE_NOTICE_GRACE_MS + 2 * DAY_MS);
}

export const AGE_NOTICE_SUBJECT = "Changes to your FishSpotter account";

/**
 * Mail domains that usually belong to a school or its pupils. A hint that
 * puts an account on the notice list, never a decision on its own: the admin
 * chooses who is mailed.
 */
const SCHOOL_LIKE_DOMAIN =
  /(\.sch\.|k12|\.edu$|\.edu\.|school|student|pupil|academy|isd\.|usd\.|christian\.org$)/i;

export function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).toLowerCase();
}

export function isSchoolLikeEmail(email: string | null | undefined): boolean {
  if (!email || isPlaceholderEmail(email)) return false;
  return SCHOOL_LIKE_DOMAIN.test(emailDomain(email));
}

/** The moment whose UK calendar date is the removal date the email states. */
export function removalDateFor(sentAt: Date): Date {
  return new Date(sentAt.getTime() + AGE_NOTICE_GRACE_MS);
}

const UK_DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "2026-09-30": the calendar day in UK time, in a form that sorts. */
export function ukDay(d: Date): string {
  const part = (type: string) => UK_DAY.formatToParts(d).find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * Whether the address noticed at `sentAt` should go now: from the start of
 * the UK day the email named. The daily job (05:00 UTC) therefore removes it
 * on the morning of that day, never the day after, so the email is exact.
 */
export function isRemovalDue(sentAt: Date, now: Date): boolean {
  return ukDay(removalDateFor(sentAt)) <= ukDay(now);
}

/** "30 September 2026", in UK time, for the email and the admin page. */
export function formatNoticeDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
}

export interface AgeNoticeTarget {
  id: string;
  email: string;
  displayName: string | null;
  name: string | null;
  isGuest: boolean;
  ageBracket: string | null;
  ageNoticeSentAt: Date | null;
}

export type AgeNoticeDecision = { send: true } | { send: false; reason: string };

/** Whether to send the notice to this account now. Pure. */
export function decideAgeNotice(target: AgeNoticeTarget | null): AgeNoticeDecision {
  if (!target) return { send: false, reason: "account not found" };
  if (target.ageNoticeSentAt) return { send: false, reason: "already told" };
  if (target.isGuest || isPlaceholderEmail(target.email)) {
    return { send: false, reason: "no email address on the account any more" };
  }
  if (target.ageBracket) return { send: false, reason: "has told us their age since" };
  if (!isSchoolLikeEmail(target.email)) return { send: false, reason: "not a school-like address" };
  return { send: true };
}

const TARGET_SELECT = {
  id: true,
  email: true,
  displayName: true,
  name: true,
  isGuest: true,
  ageBracket: true,
  ageNoticeSentAt: true,
  createdAt: true,
  _count: { select: { answers: true } },
} as const;

export async function readAgeNoticeTarget(
  prisma: Pick<PrismaClient, "user">,
  userId: string,
): Promise<AgeNoticeTarget | null> {
  return prisma.user.findUnique({ where: { id: userId }, select: TARGET_SELECT });
}

export interface AgeNoticeRow {
  userId: string;
  spotter: string;
  email: string;
  joinedAt: string;
  identifications: number;
  /** ISO, when the notice went; null if not yet. */
  noticeSentAt: string | null;
  /** "16 September 2026", the same moment written out; null if not yet. */
  noticeSentOn: string | null;
  /** "30 September 2026", when the address is due to go; null if not noticed. */
  removalOn: string | null;
}

/**
 * Accounts with a school-like address that either still need the notice
 * (no age given) or have had it and are waiting for the removal date.
 */
export async function loadAgeNoticeRows(
  prisma: Pick<PrismaClient, "user">,
): Promise<AgeNoticeRow[]> {
  const users = await prisma.user.findMany({
    where: {
      isGuest: false,
      OR: [{ ageBracket: null }, { ageNoticeSentAt: { not: null } }],
    },
    select: TARGET_SELECT,
    orderBy: { createdAt: "asc" },
  });
  return users
    .filter((u) => isSchoolLikeEmail(u.email))
    .map((u) => ({
      userId: u.id,
      spotter: u.displayName?.trim() || u.name?.trim() || "Unnamed spotter",
      email: u.email,
      joinedAt: u.createdAt.toISOString(),
      identifications: u._count.answers,
      noticeSentAt: u.ageNoticeSentAt?.toISOString() ?? null,
      noticeSentOn: u.ageNoticeSentAt ? formatNoticeDate(u.ageNoticeSentAt) : null,
      removalOn: u.ageNoticeSentAt ? formatNoticeDate(removalDateFor(u.ageNoticeSentAt)) : null,
    }));
}

/** Record the notice. Only stamps an account that has not been told yet. */
export async function markAgeNoticeSent(
  prisma: Pick<PrismaClient, "user">,
  userId: string,
  now: Date,
): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, ageNoticeSentAt: null },
    data: { ageNoticeSentAt: now },
  });
}
