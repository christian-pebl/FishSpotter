/**
 * The catch-up send: fresh links for every account that has a real email
 * address and never confirmed it.
 *
 * Why it exists (16 Sep 2026). SendGrid refused every message from early
 * August until the switch to Resend on 15 Sep, and the app reported success
 * throughout. A production pull the next day found 41 accounts with a real
 * address and no confirmation. 32 of them had no password either: guests who
 * saved their progress with an email, whose "set a password" link never
 * arrived, so they could not sign back in and could never claim a prize. Only
 * one of them (a spotter who wrote in) had told us anything was wrong.
 *
 * Who gets what:
 *   setup   no password yet. A one-time set-a-password link; using it also
 *           confirms the address (POST /api/auth/reset). One email, one click.
 *   verify  already has a password, or is on the admin domain, where setting a
 *           password does not confirm the address. A verification link.
 *
 * An admin sends it from /admin/email, one account per request, and the
 * server re-derives everything here rather than trusting the page.
 */

import type { PrismaClient } from "@prisma/client";
import { isAdminEmail } from "@/lib/admin-email";

export type CatchUpKind = "setup" | "verify";

const HOUR_MS = 60 * 60 * 1000;

/** Verification links cannot take over an account, so they can live a week. */
export const CATCH_UP_VERIFY_TTL_MS = 7 * 24 * HOUR_MS;
export const CATCH_UP_VERIFY_EXPIRES_IN = "7 days";

/**
 * A setup link sets the first password on the account, so it stays shorter.
 * Long enough for an unexpected email opened a day or two late; an expired
 * link falls back to "forgot password", which works now.
 */
export const CATCH_UP_SETUP_TTL_MS = 3 * 24 * HOUR_MS;
export const CATCH_UP_SETUP_EXPIRES_IN = "3 days";

/** Nobody gets two links inside this window, from this tool or anywhere else. */
export const CATCH_UP_COOLDOWN_MS = 24 * HOUR_MS;

export const CATCH_UP_VERIFY_SUBJECT = "A fresh link to confirm your FishSpotter email";
export const CATCH_UP_SETUP_SUBJECT = "Finish setting up your FishSpotter account";

export const CATCH_UP_VERIFY_INTRO =
  "For several weeks in August and September our emails weren't being sent, so the link to confirm your address may never have reached you. Sorry about that. Here is a fresh one. You need a confirmed address to claim FishSpotter prizes.";

export const CATCH_UP_SETUP_INTRO =
  "For several weeks in August and September our emails weren't being sent, so the link to set your password after you saved your progress may never have reached you. Sorry about that. Here is a fresh one.";

export interface CatchUpInput {
  email: string;
  hasPassword: boolean;
  /** The newest verification or password link minted for this account, if any. */
  lastLinkAt: Date | null;
}

export interface CatchUpPlan {
  kind: CatchUpKind;
  /** False while a link from the last CATCH_UP_COOLDOWN_MS may still be in someone's inbox. */
  ready: boolean;
}

export function planCatchUp(input: CatchUpInput, now: Date): CatchUpPlan {
  const kind: CatchUpKind =
    !input.hasPassword && !isAdminEmail(input.email) ? "setup" : "verify";
  const ready =
    input.lastLinkAt === null ||
    now.getTime() - input.lastLinkAt.getTime() >= CATCH_UP_COOLDOWN_MS;
  return { kind, ready };
}

/** The newer of two optional timestamps. */
export function latest(a: Date | null | undefined, b: Date | null | undefined): Date | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a.getTime() >= b.getTime() ? a : b;
}

/** One row of the admin table. Plain data, safe to hand to a client component. */
export interface CatchUpRow {
  userId: string;
  spotter: string;
  email: string;
  joinedAt: string;
  identifications: number;
  kind: CatchUpKind;
  ready: boolean;
  lastLinkAt: string | null;
  /** A trust-seed (staff or family) account, flagged so it is easy to leave out. */
  seed: boolean;
}

const BACKLOG_SELECT = {
  id: true,
  email: true,
  displayName: true,
  name: true,
  createdAt: true,
  isTrustSeed: true,
  passwordHash: true,
  _count: { select: { answers: true } },
  verificationTokens: {
    select: { createdAt: true },
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
  passwordResetTokens: {
    select: { createdAt: true },
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
};

/**
 * Every non-guest account with no confirmed address, oldest first. The
 * password hash is read only to learn whether one exists; it never leaves
 * this function.
 */
export async function readCatchUpBacklog(prisma: PrismaClient, now: Date): Promise<CatchUpRow[]> {
  const users = await prisma.user.findMany({
    // Accounts told their school address will be removed
    // (src/lib/age-notice.ts) are never sent account links again.
    where: { isGuest: false, emailVerified: null, ageNoticeSentAt: null },
    select: BACKLOG_SELECT,
    orderBy: { createdAt: "asc" },
  });

  return users.map((u) => {
    const lastLinkAt = latest(
      u.verificationTokens[0]?.createdAt,
      u.passwordResetTokens[0]?.createdAt,
    );
    const plan = planCatchUp(
      { email: u.email, hasPassword: u.passwordHash !== null, lastLinkAt },
      now,
    );
    return {
      userId: u.id,
      spotter: u.displayName?.trim() || u.name?.trim() || "Unnamed spotter",
      email: u.email,
      joinedAt: u.createdAt.toISOString(),
      identifications: u._count.answers,
      kind: plan.kind,
      ready: plan.ready,
      lastLinkAt: lastLinkAt?.toISOString() ?? null,
      seed: u.isTrustSeed,
    };
  });
}

/** What the server knows about one account at send time. */
export interface CatchUpTarget {
  id: string;
  email: string;
  displayName: string | null;
  name: string | null;
  isGuest: boolean;
  emailVerified: Date | null;
  hasPassword: boolean;
  lastLinkAt: Date | null;
  /** Told that this school-like address will be removed (src/lib/age-notice.ts). */
  ageNoticeSent: boolean;
}

export async function readCatchUpTarget(
  prisma: PrismaClient,
  userId: string,
): Promise<CatchUpTarget | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      name: true,
      isGuest: true,
      emailVerified: true,
      passwordHash: true,
      ageNoticeSentAt: true,
      verificationTokens: BACKLOG_SELECT.verificationTokens,
      passwordResetTokens: BACKLOG_SELECT.passwordResetTokens,
    },
  });
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    name: u.name,
    isGuest: u.isGuest,
    emailVerified: u.emailVerified,
    hasPassword: u.passwordHash !== null,
    lastLinkAt: latest(u.verificationTokens[0]?.createdAt, u.passwordResetTokens[0]?.createdAt),
    ageNoticeSent: u.ageNoticeSentAt !== null,
  };
}

export type CatchUpDecision =
  | { send: true; kind: CatchUpKind }
  | { send: false; reason: string };

/** Whether to send to this account right now, and which email. Pure. */
export function decideCatchUp(target: CatchUpTarget | null, now: Date): CatchUpDecision {
  if (!target) return { send: false, reason: "account not found" };
  if (target.isGuest) return { send: false, reason: "guest account, no real address" };
  if (target.emailVerified) return { send: false, reason: "already confirmed" };
  if (target.ageNoticeSent) {
    return { send: false, reason: "told this school address will be removed" };
  }
  const plan = planCatchUp(
    { email: target.email, hasPassword: target.hasPassword, lastLinkAt: target.lastLinkAt },
    now,
  );
  if (!plan.ready) return { send: false, reason: "a link went out in the last 24 hours" };
  return { send: true, kind: plan.kind };
}
