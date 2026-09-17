/**
 * Parental consent: what a child spotter cannot agree to alone.
 *
 * Two purposes (PARENTAL_CONSENT_PURPOSES):
 *   account  An under-13 keeps a saved account. We never collect the child's
 *            own email. The parent's address is held on the consent row, and
 *            the parent signs the child in on any device from the parent page.
 *   prize    A spotter under 18 wants the prize posted. PEBL then arranges
 *            delivery with the parent, not the child.
 *
 * The method is the one COPPA calls "email plus", allowed where a child's
 * information is only used inside the service and never disclosed:
 *   1. The child gives a parent's address. We email the parent a notice of
 *      what we collect and why, with a link (requestConsent).
 *   2. The parent reads the notice and agrees or says no (grantConsent,
 *      declineConsent). No means the row, and the parent's address, are gone.
 *   3. A day after agreement we send a second email that repeats the notice
 *      and links to review, export, delete or withdraw (the "plus"). The FTC
 *      describes this confirmation as sent after a reasonable delay, so it
 *      goes from the daily cron (findDueConfirmations), not at once.
 * An unanswered request expires after CONSENT_REQUEST_TTL_MS and the
 * child-data-retention cron deletes it, parent address and all.
 *
 * Every emailed token is stored hashed, like the password reset tokens.
 * Database helpers take the Prisma client as an argument so the integration
 * tests can run them against a real Postgres.
 */

import type { PrismaClient } from "@prisma/client";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { isMinor, isPlaceholderEmail, isUnder13, type AgeBand } from "@/lib/age";
import { isRemovalDue, removalCandidateCutoff } from "@/lib/age-notice";
import { stripContactOps } from "@/lib/child-contact";
import { SEASEARCH_GUIDE_ID } from "@/lib/prize";
import {
  CONSENT_REQUEST_TTL_WORDS,
  PARENTAL_CONSENT_PURPOSES,
  isConsentPurpose,
  summariseConsents,
  type ConsentState,
  type ConsentSummary,
  type ParentalConsentPurpose,
} from "@/lib/parental-consent-shared";

export {
  CONSENT_REQUEST_TTL_WORDS,
  PARENTAL_CONSENT_PURPOSES,
  isConsentPurpose,
  summariseConsents,
};
export type { ConsentState, ConsentSummary, ParentalConsentPurpose };

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long a parent has to answer before the request and their address are deleted. */
export const CONSENT_REQUEST_TTL_MS = 14 * DAY_MS;

/** A manage link asked for on /parent. */
export const MANAGE_TOKEN_TTL_MS = 60 * 60 * 1000;
export const MANAGE_TOKEN_TTL_WORDS = "1 hour";

/** The manage link inside the confirmation email. */
export const CONFIRMATION_MANAGE_TTL_MS = 7 * DAY_MS;
export const CONFIRMATION_MANAGE_TTL_WORDS = "7 days";

/** How long after agreement the confirmation email waits. */
export const CONFIRMATION_DELAY_MS = 24 * 60 * 60 * 1000;

/** A one-time "sign this device in as my child" token. */
export const CHILD_SIGNIN_TOKEN_TTL_MS = 10 * 60 * 1000;

/** An under-13 account with no activity for this long is deleted. */
export const CHILD_ACCOUNT_INACTIVE_MS = 365 * DAY_MS;

/** A prize consent, and the parent's address on it, outlives the posting by this much. */
export const PRIZE_CONSENT_KEEP_AFTER_POSTING_MS = 90 * DAY_MS;

/**
 * Which bands may ask for which consent. An account consent is only for
 * under-13s (13-17s save with their own email); a prize consent is for
 * anyone under 18.
 */
export function purposeAllowedFor(
  purpose: ParentalConsentPurpose,
  ageBand: AgeBand | string | null | undefined,
): boolean {
  if (purpose === "account") return isUnder13(ageBand);
  return isMinor(ageBand);
}

export function normaliseParentEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** "jane.doe@example.com" -> "j***@example.com", for staff screens. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

/** A pending request counts only until its link expires. */
export function isRequestLive(
  row: { status: string; requestExpiresAt: Date | null },
  now: Date,
): boolean {
  return (
    row.status === "pending" &&
    row.requestExpiresAt !== null &&
    row.requestExpiresAt.getTime() > now.getTime()
  );
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

type Db = Pick<
  PrismaClient,
  "parentalConsent" | "parentAccessToken" | "user" | "answer" | "pebblePurchase"
>;

/** The consent summary for one child, ignoring requests whose link has expired. */
export async function loadConsentSummary(
  prisma: Db,
  childId: string,
  now: Date,
): Promise<ConsentSummary> {
  const rows = await prisma.parentalConsent.findMany({
    where: { childId },
    select: { purpose: true, status: true, requestExpiresAt: true },
  });
  return summariseConsents(
    rows.filter((r) => r.status === "granted" || isRequestLive(r, now)),
  );
}

/**
 * What the prize gate needs to know about a child's consents
 * (src/lib/prize-requirements.ts, PrizeClaimInput).
 */
export async function loadConsentContext(
  prisma: Db,
  childId: string,
  now: Date,
): Promise<{ consents: ConsentSummary; accountConsentGrantedAt: Date | null }> {
  const rows = await prisma.parentalConsent.findMany({
    where: { childId },
    select: { purpose: true, status: true, requestExpiresAt: true, grantedAt: true },
  });
  const live = rows.filter((r) => r.status === "granted" || isRequestLive(r, now));
  const account = live.find((r) => r.purpose === "account" && r.status === "granted");
  return {
    consents: summariseConsents(live),
    accountConsentGrantedAt: account?.grantedAt ?? null,
  };
}

export async function hasGrantedConsent(
  prisma: Db,
  childId: string,
  purpose: ParentalConsentPurpose,
): Promise<boolean> {
  const row = await prisma.parentalConsent.findUnique({
    where: { childId_purpose: { childId, purpose } },
    select: { status: true },
  });
  return row?.status === "granted";
}

export type RequestConsentResult =
  | { kind: "created"; consentId: string; plainToken: string }
  | { kind: "already-granted" };

/**
 * Open (or re-open) a request. One row per child and purpose: asking again
 * replaces the address and the link, so an old link stops working and a
 * mistyped address is simply overwritten. A granted consent is left alone.
 */
export async function createConsentRequest(
  prisma: Db,
  input: { childId: string; purpose: ParentalConsentPurpose; parentEmail: string },
  now: Date,
): Promise<RequestConsentResult> {
  const existing = await prisma.parentalConsent.findUnique({
    where: { childId_purpose: { childId: input.childId, purpose: input.purpose } },
    select: { status: true },
  });
  if (existing?.status === "granted") return { kind: "already-granted" };

  const plainToken = generateToken();
  const data = {
    parentEmail: normaliseParentEmail(input.parentEmail),
    status: "pending",
    requestTokenHash: hashToken(plainToken),
    requestExpiresAt: new Date(now.getTime() + CONSENT_REQUEST_TTL_MS),
    requestedAt: now,
    grantedAt: null,
    ukAddressConfirmed: false,
  };
  const row = await prisma.parentalConsent.upsert({
    where: { childId_purpose: { childId: input.childId, purpose: input.purpose } },
    create: { childId: input.childId, purpose: input.purpose, ...data },
    update: data,
    select: { id: true },
  });
  return { kind: "created", consentId: row.id, plainToken };
}

/**
 * The parent's address from a child's granted account consent, so a prize
 * request can go to the same grown-up without the child ever seeing it.
 */
export async function accountConsentParentEmail(
  prisma: Db,
  childId: string,
): Promise<string | null> {
  const row = await prisma.parentalConsent.findUnique({
    where: { childId_purpose: { childId, purpose: "account" } },
    select: { status: true, parentEmail: true },
  });
  return row?.status === "granted" ? row.parentEmail : null;
}

export interface PendingConsent {
  id: string;
  purpose: ParentalConsentPurpose;
  parentEmail: string;
  childId: string;
  childName: string;
  childAgeBand: string | null;
  requestedAt: Date;
}

/** Look up a live request from the token in the parent's email. */
export async function findPendingConsentByToken(
  prisma: Db,
  plainToken: string,
  now: Date,
): Promise<PendingConsent | null> {
  if (!/^[0-9a-f]{64}$/.test(plainToken)) return null;
  const row = await prisma.parentalConsent.findUnique({
    where: { requestTokenHash: hashToken(plainToken) },
    select: {
      id: true,
      purpose: true,
      status: true,
      parentEmail: true,
      requestExpiresAt: true,
      requestedAt: true,
      child: { select: { id: true, displayName: true, name: true, ageBracket: true } },
    },
  });
  if (!row || !isRequestLive(row, now) || !isConsentPurpose(row.purpose)) return null;
  return {
    id: row.id,
    purpose: row.purpose,
    parentEmail: row.parentEmail,
    childId: row.child.id,
    childName: row.child.displayName ?? row.child.name ?? "your child",
    childAgeBand: row.child.ageBracket,
    requestedAt: row.requestedAt,
  };
}

/** Record a yes. The request link stops working at once. */
export async function grantConsent(
  prisma: Db,
  consentId: string,
  opts: { ukAddressConfirmed: boolean },
  now: Date,
): Promise<void> {
  await prisma.parentalConsent.update({
    where: { id: consentId },
    data: {
      status: "granted",
      grantedAt: now,
      requestTokenHash: null,
      requestExpiresAt: null,
      ukAddressConfirmed: opts.ukAddressConfirmed,
    },
  });
}

export interface DueConfirmation {
  id: string;
  purpose: ParentalConsentPurpose;
  parentEmail: string;
  childName: string;
  grantedAt: Date;
}

/** Granted consents whose confirmation email is due (a day old, not yet sent). */
export async function findDueConfirmations(
  prisma: Db,
  now: Date,
  take = 100,
): Promise<DueConfirmation[]> {
  const rows = await prisma.parentalConsent.findMany({
    where: {
      status: "granted",
      confirmationSentAt: null,
      grantedAt: { lte: new Date(now.getTime() - CONFIRMATION_DELAY_MS) },
    },
    select: {
      id: true,
      purpose: true,
      parentEmail: true,
      grantedAt: true,
      child: { select: { displayName: true, name: true } },
    },
    orderBy: { grantedAt: "asc" },
    take,
  });
  return rows
    .filter((r) => isConsentPurpose(r.purpose))
    .map((r) => ({
      id: r.id,
      purpose: r.purpose as ParentalConsentPurpose,
      parentEmail: r.parentEmail,
      childName: r.child.displayName ?? r.child.name ?? "your child",
      grantedAt: r.grantedAt ?? now,
    }));
}

export async function markConfirmationSent(prisma: Db, consentId: string, now: Date): Promise<void> {
  await prisma.parentalConsent.updateMany({
    where: { id: consentId },
    data: { confirmationSentAt: now },
  });
}

/** Record a no by deleting the request, and with it the parent's address. */
export async function declineConsent(prisma: Db, consentId: string): Promise<void> {
  await prisma.parentalConsent.deleteMany({ where: { id: consentId } });
}

async function createParentToken(
  prisma: Db,
  input: {
    kind: "manage" | "child-signin";
    parentEmail: string;
    childId?: string;
    ttlMs: number;
  },
  now: Date,
): Promise<string> {
  const plain = generateToken();
  await prisma.parentAccessToken.create({
    data: {
      kind: input.kind,
      tokenHash: hashToken(plain),
      parentEmail: normaliseParentEmail(input.parentEmail),
      childId: input.childId ?? null,
      expiresAt: new Date(now.getTime() + input.ttlMs),
    },
  });
  return plain;
}

/**
 * A manage link for a parent, or null when the address is not linked to any
 * child. The route answers the same either way, so nobody can use it to find
 * out whether an address belongs to a parent here.
 */
export async function createManageToken(
  prisma: Db,
  parentEmail: string,
  now: Date,
  ttlMs: number = MANAGE_TOKEN_TTL_MS,
): Promise<string | null> {
  const email = normaliseParentEmail(parentEmail);
  const linked = await prisma.parentalConsent.count({ where: { parentEmail: email } });
  if (linked === 0) return null;
  return createParentToken(prisma, { kind: "manage", parentEmail: email, ttlMs }, now);
}

/** The parent's address behind a live manage link, or null. */
export async function resolveManageToken(
  prisma: Db,
  plainToken: string,
  now: Date,
): Promise<string | null> {
  if (!/^[0-9a-f]{64}$/.test(plainToken)) return null;
  const row = await prisma.parentAccessToken.findUnique({
    where: { tokenHash: hashToken(plainToken) },
    select: { kind: true, parentEmail: true, expiresAt: true },
  });
  if (!row || row.kind !== "manage" || row.expiresAt.getTime() <= now.getTime()) return null;
  return row.parentEmail;
}

export interface ParentChildView {
  childId: string;
  childName: string;
  ageBand: string | null;
  joinedAt: Date;
  identifications: number;
  pebbles: number;
  consents: Array<{
    purpose: ParentalConsentPurpose;
    status: "pending" | "granted";
    requestedAt: Date;
    grantedAt: Date | null;
    ukAddressConfirmed: boolean;
    live: boolean;
  }>;
}

/** Everything a parent's manage page shows, for every child linked to them. */
export async function listChildrenForParent(
  prisma: Db,
  parentEmail: string,
  now: Date,
): Promise<ParentChildView[]> {
  const rows = await prisma.parentalConsent.findMany({
    where: { parentEmail: normaliseParentEmail(parentEmail) },
    select: {
      purpose: true,
      status: true,
      requestedAt: true,
      grantedAt: true,
      requestExpiresAt: true,
      ukAddressConfirmed: true,
      child: {
        select: { id: true, displayName: true, name: true, ageBracket: true, createdAt: true },
      },
    },
    orderBy: { requestedAt: "asc" },
  });

  const byChild = new Map<string, ParentChildView>();
  for (const r of rows) {
    if (!isConsentPurpose(r.purpose)) continue;
    if (r.status !== "granted" && r.status !== "pending") continue;
    let view = byChild.get(r.child.id);
    if (!view) {
      view = {
        childId: r.child.id,
        childName: r.child.displayName ?? r.child.name ?? "Spotter",
        ageBand: r.child.ageBracket,
        joinedAt: r.child.createdAt,
        identifications: 0,
        pebbles: 0,
        consents: [],
      };
      byChild.set(r.child.id, view);
    }
    view.consents.push({
      purpose: r.purpose,
      status: r.status,
      requestedAt: r.requestedAt,
      grantedAt: r.grantedAt,
      ukAddressConfirmed: r.ukAddressConfirmed,
      live: r.status === "granted" || isRequestLive(r, now),
    });
  }

  const ids = Array.from(byChild.keys());
  if (ids.length > 0) {
    const totals = await prisma.answer.groupBy({
      by: ["userId"],
      where: { userId: { in: ids } },
      _count: { _all: true },
      _sum: { points: true },
    });
    for (const t of totals) {
      const view = byChild.get(t.userId);
      if (!view) continue;
      view.identifications = t._count._all;
      view.pebbles = t._sum.points ?? 0;
    }
  }
  return Array.from(byChild.values());
}

/**
 * The consent this parent address holds for this child and purpose, or null.
 * The manage routes check the STATUS, not just the link: a parent whose
 * request is still pending can say no, but only a parent who agreed to the
 * account may sign the child in or delete it.
 */
export async function findParentConsent(
  prisma: Db,
  parentEmail: string,
  childId: string,
  purpose: ParentalConsentPurpose,
): Promise<{ id: string; status: string } | null> {
  const row = await prisma.parentalConsent.findUnique({
    where: { childId_purpose: { childId, purpose } },
    select: { id: true, status: true, parentEmail: true },
  });
  if (!row || row.parentEmail !== normaliseParentEmail(parentEmail)) return null;
  return { id: row.id, status: row.status };
}

/**
 * A one-time token that signs a device in as the child. Only for a parent
 * holding a GRANTED account consent: a prize-only consent does not make
 * someone the child's account holder.
 */
export async function createChildSignInToken(
  prisma: Db,
  parentEmail: string,
  childId: string,
  now: Date,
): Promise<string | null> {
  const email = normaliseParentEmail(parentEmail);
  const consent = await prisma.parentalConsent.findUnique({
    where: { childId_purpose: { childId, purpose: "account" } },
    select: { status: true, parentEmail: true },
  });
  if (consent?.status !== "granted" || consent.parentEmail !== email) return null;
  return createParentToken(
    prisma,
    { kind: "child-signin", parentEmail: email, childId, ttlMs: CHILD_SIGNIN_TOKEN_TTL_MS },
    now,
  );
}

/**
 * Spend a child sign-in token. Single use: the claim is one conditional
 * update, so two tabs racing the same token cannot both win. Returns the
 * child's id only if the account is still an under-13 with a granted
 * account consent from the same parent.
 */
export async function consumeChildSignInToken(
  prisma: Db,
  plainToken: string,
  now: Date,
): Promise<string | null> {
  if (!/^[0-9a-f]{64}$/.test(plainToken)) return null;
  const tokenHash = hashToken(plainToken);
  const claimed = await prisma.parentAccessToken.updateMany({
    where: { tokenHash, kind: "child-signin", usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (claimed.count !== 1) return null;
  const row = await prisma.parentAccessToken.findUnique({
    where: { tokenHash },
    select: { childId: true, parentEmail: true },
  });
  if (!row?.childId) return null;
  const [child, consent] = await Promise.all([
    prisma.user.findUnique({ where: { id: row.childId }, select: { ageBracket: true } }),
    prisma.parentalConsent.findUnique({
      where: { childId_purpose: { childId: row.childId, purpose: "account" } },
      select: { status: true, parentEmail: true },
    }),
  ]);
  if (!child || !isUnder13(child.ageBracket)) return null;
  if (consent?.status !== "granted" || consent.parentEmail !== row.parentEmail) return null;
  return row.childId;
}

/** Withdraw a prize consent: the row goes, so the claim gate closes again. */
export async function withdrawPrizeConsent(
  prisma: Db,
  parentEmail: string,
  childId: string,
): Promise<boolean> {
  const res = await prisma.parentalConsent.deleteMany({
    where: { childId, purpose: "prize", parentEmail: normaliseParentEmail(parentEmail) },
  });
  return res.count > 0;
}

/**
 * Delete a child's account and everything hanging off it (answers, comments,
 * consents, tokens all cascade). Used when a parent asks, when a parent
 * withdraws an account consent, and by the inactivity rule.
 */
export async function deleteChildAccount(prisma: Db, childId: string): Promise<boolean> {
  const res = await prisma.user.deleteMany({ where: { id: childId } });
  return res.count > 0;
}

export interface PurgeResult {
  expiredRequests: number;
  expiredTokens: number;
  spentPrizeConsents: number;
  noticedAddressesRemoved: number;
  inactiveChildAccounts: number;
}

/**
 * The retention rules in the privacy policy, applied. Runs daily
 * (/api/cron/child-data-retention).
 *   - An unanswered request is deleted once its link expires, taking the
 *     parent's address with it.
 *   - Expired parent links are deleted.
 *   - A prize consent is deleted, parent address and all, once the prize
 *     was posted PRIZE_CONSENT_KEEP_AFTER_POSTING_MS ago.
 *   - A school-like address the account was told about (src/lib/age-notice.ts)
 *     is removed on the UK date the notice gave (14 days on). An account that
 *     has not told us its age, or is under 13, gets the full child strip.
 *   - An under-13 account with no identification for CHILD_ACCOUNT_INACTIVE_MS
 *     (or, with none at all, created that long ago) is deleted.
 */
export async function purgeChildData(
  prisma: PrismaClient,
  now: Date,
  opts: { maxAccounts?: number } = {},
): Promise<PurgeResult> {
  const expiredRequests = await prisma.parentalConsent.deleteMany({
    where: { status: "pending", requestExpiresAt: { lte: now } },
  });
  const expiredTokens = await prisma.parentAccessToken.deleteMany({
    where: { expiresAt: { lte: now } },
  });

  const posted = await prisma.pebblePurchase.findMany({
    where: {
      itemId: SEASEARCH_GUIDE_ID,
      fulfilledAt: { lte: new Date(now.getTime() - PRIZE_CONSENT_KEEP_AFTER_POSTING_MS) },
    },
    select: { userId: true },
  });
  const spentPrizeConsents =
    posted.length === 0
      ? { count: 0 }
      : await prisma.parentalConsent.deleteMany({
          where: { purpose: "prize", childId: { in: posted.map((p) => p.userId) } },
        });

  const noticed = await prisma.user.findMany({
    where: { ageNoticeSentAt: { lte: removalCandidateCutoff(now) } },
    select: { id: true, email: true, ageBracket: true, ageNoticeSentAt: true },
    orderBy: { ageNoticeSentAt: "asc" },
    take: opts.maxAccounts ?? 200,
  });
  let noticedAddressesRemoved = 0;
  for (const u of noticed) {
    if (!u.ageNoticeSentAt || !isRemovalDue(u.ageNoticeSentAt, now)) continue;
    if (isPlaceholderEmail(u.email)) {
      await prisma.user.update({
        where: { id: u.id },
        data: { ageNoticeSentAt: null },
        select: { id: true },
      });
      continue;
    }
    // Not told us an age, or under 13: possibly a child, so the full strip.
    const asChild = !u.ageBracket || isUnder13(u.ageBracket);
    await prisma.$transaction(
      stripContactOps(prisma, u.id, { asChild, data: { ageNoticeSentAt: null } }),
    );
    noticedAddressesRemoved++;
  }

  const cutoff = new Date(now.getTime() - CHILD_ACCOUNT_INACTIVE_MS);
  const candidates = await prisma.user.findMany({
    where: { ageBracket: "under_13", createdAt: { lte: cutoff } },
    select: { id: true },
    take: opts.maxAccounts ?? 200,
  });
  let inactiveChildAccounts = 0;
  for (const c of candidates) {
    const recent = await prisma.answer.findFirst({
      where: { userId: c.id, createdAt: { gt: cutoff } },
      select: { id: true },
    });
    if (recent) continue;
    if (await deleteChildAccount(prisma, c.id)) inactiveChildAccounts++;
  }

  return {
    expiredRequests: expiredRequests.count,
    expiredTokens: expiredTokens.count,
    spentPrizeConsents: spentPrizeConsents.count,
    noticedAddressesRemoved,
    inactiveChildAccounts,
  };
}
