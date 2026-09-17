/**
 * Parental consent against a real Postgres (src/lib/parental-consent.ts).
 *
 * Runs only when CONSENT_TEST_DATABASE_URL points at a throwaway database
 * whose schema matches prisma/schema.prisma (CI's integration job sets it).
 * Every token here is a credential that controls a child's account, so the
 * properties pinned are the ones a bug would turn into harm: links work once,
 * expire, only reach the right child, and deleted data is really gone.
 */

import { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import {
  CONSENT_REQUEST_TTL_MS,
  CHILD_ACCOUNT_INACTIVE_MS,
  CONFIRMATION_DELAY_MS,
  MANAGE_TOKEN_TTL_MS,
  consumeChildSignInToken,
  createChildSignInToken,
  createConsentRequest,
  createManageToken,
  declineConsent,
  findDueConfirmations,
  findParentConsent,
  findPendingConsentByToken,
  grantConsent,
  listChildrenForParent,
  loadConsentContext,
  markConfirmationSent,
  purgeChildData,
  resolveManageToken,
} from "./parental-consent";
import {
  AGE_NOTICE_GRACE_MS,
  decideAgeNotice,
  loadAgeNoticeRows,
  markAgeNoticeSent,
  readAgeNoticeTarget,
} from "./age-notice";
import { isPlaceholderEmail } from "./age";

const url = process.env.CONSENT_TEST_DATABASE_URL;
const prisma = url
  ? new PrismaClient({ datasources: { db: { url } } })
  : (null as unknown as PrismaClient);

const NOW = new Date("2026-09-16T12:00:00Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);

async function seedChild(id: string, ageBracket = "under_13", createdAt = NOW) {
  await prisma.user.create({
    data: {
      id,
      email: `guest_${id}@guest.fishspotter.local`,
      isGuest: true,
      displayName: `Swift${id}42`,
      ageBracket,
      leaderboardOptIn: false,
      createdAt,
    },
  });
}

async function agreedAccount(childId: string, parentEmail: string) {
  const req = await createConsentRequest(
    prisma,
    { childId, purpose: "account", parentEmail },
    NOW,
  );
  if (req.kind !== "created") throw new Error("expected a new request");
  const pending = await findPendingConsentByToken(prisma, req.plainToken, NOW);
  if (!pending) throw new Error("request not found");
  await grantConsent(prisma, pending.id, { ukAddressConfirmed: false }, NOW);
  return pending.id;
}

describe.skipIf(!url)("parental consent (integration)", () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "ParentAccessToken","ParentalConsent","PebblePurchase","Answer","Snippet","User" RESTART IDENTITY CASCADE',
    );
  });

  it("opens a request that only its own link can find, and only until it expires", async () => {
    await seedChild("kid");
    const req = await createConsentRequest(
      prisma,
      { childId: "kid", purpose: "account", parentEmail: " Mum@Home.test " },
      NOW,
    );
    expect(req.kind).toBe("created");
    if (req.kind !== "created") return;

    const found = await findPendingConsentByToken(prisma, req.plainToken, NOW);
    expect(found?.parentEmail).toBe("mum@home.test");
    expect(found?.childName).toBe("Swiftkid42");

    // The stored value is a hash, never the link itself.
    const row = await prisma.parentalConsent.findFirstOrThrow({ where: { childId: "kid" } });
    expect(row.requestTokenHash).not.toBe(req.plainToken);

    expect(await findPendingConsentByToken(prisma, "0".repeat(64), NOW)).toBeNull();
    expect(await findPendingConsentByToken(prisma, "not-a-token", NOW)).toBeNull();
    expect(
      await findPendingConsentByToken(prisma, req.plainToken, later(CONSENT_REQUEST_TTL_MS)),
    ).toBeNull();
  });

  it("replaces the address and link when a child asks again", async () => {
    await seedChild("kid");
    const first = await createConsentRequest(
      prisma,
      { childId: "kid", purpose: "account", parentEmail: "typo@home.test" },
      NOW,
    );
    const second = await createConsentRequest(
      prisma,
      { childId: "kid", purpose: "account", parentEmail: "mum@home.test" },
      NOW,
    );
    if (first.kind !== "created" || second.kind !== "created") throw new Error("expected requests");
    expect(await findPendingConsentByToken(prisma, first.plainToken, NOW)).toBeNull();
    expect((await findPendingConsentByToken(prisma, second.plainToken, NOW))?.parentEmail).toBe(
      "mum@home.test",
    );
    expect(await prisma.parentalConsent.count()).toBe(1);
  });

  it("uses a request link once, and leaves a granted consent alone", async () => {
    await seedChild("kid");
    const req = await createConsentRequest(
      prisma,
      { childId: "kid", purpose: "account", parentEmail: "mum@home.test" },
      NOW,
    );
    if (req.kind !== "created") throw new Error("expected a request");
    const pending = await findPendingConsentByToken(prisma, req.plainToken, NOW);
    await grantConsent(prisma, pending!.id, { ukAddressConfirmed: false }, NOW);

    expect(await findPendingConsentByToken(prisma, req.plainToken, NOW)).toBeNull();
    const again = await createConsentRequest(
      prisma,
      { childId: "kid", purpose: "account", parentEmail: "someone@else.test" },
      NOW,
    );
    expect(again.kind).toBe("already-granted");
    const ctx = await loadConsentContext(prisma, "kid", NOW);
    expect(ctx.consents.account).toBe("granted");
    expect(ctx.accountConsentGrantedAt?.toISOString()).toBe(NOW.toISOString());
  });

  it("deletes the parent's address when they say no", async () => {
    await seedChild("kid");
    const req = await createConsentRequest(
      prisma,
      { childId: "kid", purpose: "prize", parentEmail: "mum@home.test" },
      NOW,
    );
    if (req.kind !== "created") throw new Error("expected a request");
    await declineConsent(prisma, req.consentId);
    expect(await prisma.parentalConsent.count()).toBe(0);
  });

  it("gives a parent a manage link only for an address linked to a child", async () => {
    await seedChild("kid");
    await agreedAccount("kid", "mum@home.test");
    expect(await createManageToken(prisma, "stranger@else.test", NOW)).toBeNull();

    const token = await createManageToken(prisma, "MUM@home.test", NOW);
    expect(token).not.toBeNull();
    expect(await resolveManageToken(prisma, token!, NOW)).toBe("mum@home.test");
    expect(await resolveManageToken(prisma, token!, later(MANAGE_TOKEN_TTL_MS))).toBeNull();

    const children = await listChildrenForParent(prisma, "mum@home.test", NOW);
    expect(children.map((c) => c.childId)).toEqual(["kid"]);
    expect(children[0].consents[0]).toMatchObject({ purpose: "account", status: "granted" });
  });

  it("lets a parent sign one device in as their child, once", async () => {
    await seedChild("kid");
    await agreedAccount("kid", "mum@home.test");
    const token = await createChildSignInToken(prisma, "mum@home.test", "kid", NOW);
    expect(token).not.toBeNull();

    expect(await consumeChildSignInToken(prisma, token!, NOW)).toBe("kid");
    expect(await consumeChildSignInToken(prisma, token!, NOW)).toBeNull();
  });

  it("refuses sign-in links to the wrong parent, a pending request, an expired link or an older child", async () => {
    await seedChild("kid");
    await seedChild("teen", "13_17");
    await agreedAccount("kid", "mum@home.test");

    expect(await createChildSignInToken(prisma, "other@home.test", "kid", NOW)).toBeNull();

    await createConsentRequest(
      prisma,
      { childId: "teen", purpose: "prize", parentEmail: "mum@home.test" },
      NOW,
    );
    expect(await createChildSignInToken(prisma, "mum@home.test", "teen", NOW)).toBeNull();

    const expiring = await createChildSignInToken(prisma, "mum@home.test", "kid", NOW);
    expect(await consumeChildSignInToken(prisma, expiring!, later(60 * 60 * 1000))).toBeNull();

    // A child whose band changed after the link was made cannot be entered.
    const token = await createChildSignInToken(prisma, "mum@home.test", "kid", NOW);
    await prisma.user.update({ where: { id: "kid" }, data: { ageBracket: "18_plus" } });
    expect(await consumeChildSignInToken(prisma, token!, NOW)).toBeNull();
  });

  it("finds a parent's consent only under their own address", async () => {
    await seedChild("kid");
    await agreedAccount("kid", "mum@home.test");
    expect((await findParentConsent(prisma, "Mum@home.test", "kid", "account"))?.status).toBe(
      "granted",
    );
    expect(await findParentConsent(prisma, "dad@home.test", "kid", "account")).toBeNull();
    expect(await findParentConsent(prisma, "mum@home.test", "kid", "prize")).toBeNull();
  });

  it("sends each confirmation a day after the yes, and only once", async () => {
    await seedChild("kid");
    const id = await agreedAccount("kid", "mum@home.test");
    expect(await findDueConfirmations(prisma, later(CONFIRMATION_DELAY_MS - 1))).toHaveLength(0);
    const due = await findDueConfirmations(prisma, later(CONFIRMATION_DELAY_MS));
    expect(due.map((d) => d.id)).toEqual([id]);
    await markConfirmationSent(prisma, id, later(CONFIRMATION_DELAY_MS));
    expect(await findDueConfirmations(prisma, later(2 * CONFIRMATION_DELAY_MS))).toHaveLength(0);
  });

  it("forgets a prize consent 90 days after the book is posted, not before", async () => {
    await seedChild("teen", "13_17");
    const req = await createConsentRequest(
      prisma,
      { childId: "teen", purpose: "prize", parentEmail: "carer@home.test" },
      NOW,
    );
    if (req.kind !== "created") throw new Error("expected a request");
    await grantConsent(prisma, req.consentId, { ukAddressConfirmed: true }, NOW);
    await prisma.pebblePurchase.create({
      data: {
        userId: "teen",
        itemId: "seasearch-guide",
        pebbleCost: 0,
        fulfilledAt: NOW,
        fulfilledBy: "ops@pebl-cic.co.uk",
      },
    });
    const day = 24 * 60 * 60 * 1000;
    expect((await purgeChildData(prisma, later(89 * day))).spentPrizeConsents).toBe(0);
    expect((await purgeChildData(prisma, later(90 * day))).spentPrizeConsents).toBe(1);
    expect(await prisma.parentalConsent.count()).toBe(0);
    // The child's own account is untouched.
    expect(await prisma.user.count({ where: { id: "teen" } })).toBe(1);
  });

  it("purges unanswered requests, expired links and idle under-13 accounts", async () => {
    const longAgo = new Date(NOW.getTime() - CHILD_ACCOUNT_INACTIVE_MS - 1000);
    await seedChild("idle", "under_13", longAgo);
    await seedChild("active", "under_13", longAgo);
    await seedChild("oldteen", "13_17", longAgo);
    await seedChild("fresh");
    const snip = await prisma.snippet.create({
      data: {
        externalId: "s1",
        videoUrl: "https://example.test/v.mp4",
        thumbnailUrl: "https://example.test/t.jpg",
        site: "Test",
        deployment: "D1",
      },
    });
    await prisma.answer.create({
      data: { userId: "active", snippetId: snip.id, chosenOption: "Crab", createdAt: NOW },
    });

    await createConsentRequest(
      prisma,
      { childId: "fresh", purpose: "account", parentEmail: "mum@home.test" },
      NOW,
    );
    await agreedAccount("active", "dad@home.test");
    await createManageToken(prisma, "dad@home.test", NOW);

    const result = await purgeChildData(prisma, later(CONSENT_REQUEST_TTL_MS));
    expect(result).toEqual({
      expiredRequests: 1,
      expiredTokens: 1,
      spentPrizeConsents: 0,
      noticedAddressesRemoved: 0,
      inactiveChildAccounts: 1,
    });

    const left = await prisma.user.findMany({ select: { id: true }, orderBy: { id: "asc" } });
    expect(left.map((u) => u.id)).toEqual(["active", "fresh", "oldteen"]);
    // The granted consent survives; the unanswered one, and its address, do not.
    const consents = await prisma.parentalConsent.findMany({ select: { parentEmail: true } });
    expect(consents.map((c) => c.parentEmail)).toEqual(["dad@home.test"]);
  });
  it("tells school-like addresses, then removes them on the date the email gave", async () => {
    const snip = await prisma.snippet.create({
      data: {
        externalId: "s-notice",
        videoUrl: "https://example.test/v.mp4",
        thumbnailUrl: "https://example.test/t.jpg",
        site: "Test",
        deployment: "D1",
      },
    });
    // A saved account from the old guest path: school address, no age, the
    // lot. And one that answers "18 or over" after the notice.
    for (const [id, email] of [
      ["pupil", "c.pupil@thepegasusschool.org"],
      ["grownup", "teacher@lincoln.k12.ca.us"],
    ] as const) {
      await prisma.user.create({
        data: {
          id,
          email,
          displayName: `Name ${id}`,
          isGuest: false,
          passwordHash: "hash",
          digestOptIn: true,
          newClipsOptIn: true,
          createdAt: id === "pupil" ? NOW : later(1000),
        },
      });
      await prisma.answer.create({ data: { userId: id, snippetId: snip.id, chosenOption: "Crab" } });
      await prisma.comment.create({ data: { userId: id, snippetId: snip.id, body: "My name is Sam" } });
      await prisma.event.create({ data: { userId: id, sessionId: `tab-${id}`, type: "session_start" } });
      await prisma.verificationToken.create({
        data: { userId: id, token: `v-${id}`, expiresAt: later(24 * 60 * 60 * 1000) },
      });
      await prisma.passwordResetToken.create({
        data: { userId: id, token: `r-${id}`, expiresAt: later(60 * 60 * 1000) },
      });
      await prisma.account.create({
        data: { userId: id, type: "oauth", provider: "google", providerAccountId: `g-${id}` },
      });
    }
    // Not school-like, and a school-like account that already gave its age:
    // neither is on the list.
    await prisma.user.create({
      data: { id: "plain", email: "someone@gmail.test", isGuest: false, createdAt: NOW },
    });
    await prisma.user.create({
      data: {
        id: "answered",
        email: "x@student.scusd.edu",
        isGuest: false,
        ageBracket: "13_17",
        createdAt: NOW,
      },
    });

    let rows = await loadAgeNoticeRows(prisma);
    expect(rows.map((r) => r.userId)).toEqual(["pupil", "grownup"]);
    expect(rows.every((r) => !r.noticeSentAt && !r.noticeSentOn && !r.removalOn)).toBe(true);

    for (const id of ["pupil", "grownup"]) {
      expect(decideAgeNotice(await readAgeNoticeTarget(prisma, id))).toEqual({ send: true });
      await markAgeNoticeSent(prisma, id, NOW);
    }
    // A second stamp never moves the promised date.
    await markAgeNoticeSent(prisma, "pupil", later(3 * 24 * 60 * 60 * 1000));
    expect(decideAgeNotice(await readAgeNoticeTarget(prisma, "pupil"))).toEqual({
      send: false,
      reason: "already told",
    });
    await prisma.user.update({ where: { id: "grownup" }, data: { ageBracket: "18_plus" } });

    rows = await loadAgeNoticeRows(prisma);
    expect(rows.map((r) => [r.userId, r.noticeSentAt, r.noticeSentOn, r.removalOn])).toEqual([
      ["pupil", NOW.toISOString(), "16 September 2026", "30 September 2026"],
      ["grownup", NOW.toISOString(), "16 September 2026", "30 September 2026"],
    ]);

    // Nothing moves before the date, even at 23:59 UK time the night before.
    expect(
      (await purgeChildData(prisma, new Date("2026-09-29T22:59:00Z"))).noticedAddressesRemoved,
    ).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: "pupil" } })).email).toBe(
      "c.pupil@thepegasusschool.org",
    );

    // The 05:00 UTC run on the date the email gave.
    expect(
      (await purgeChildData(prisma, new Date("2026-09-30T05:00:00Z"))).noticedAddressesRemoved,
    ).toBe(2);

    for (const id of ["pupil", "grownup"]) {
      const u = await prisma.user.findUniqueOrThrow({ where: { id } });
      expect(isPlaceholderEmail(u.email)).toBe(true);
      expect(u).toMatchObject({
        emailVerified: null,
        passwordHash: null,
        isGuest: true,
        digestOptIn: false,
        newClipsOptIn: false,
        ageNoticeSentAt: null,
      });
      expect(await prisma.verificationToken.count({ where: { userId: id } })).toBe(0);
      expect(await prisma.passwordResetToken.count({ where: { userId: id } })).toBe(0);
      expect(await prisma.account.count({ where: { userId: id } })).toBe(0);
      // Progress stays.
      expect(await prisma.answer.count({ where: { userId: id } })).toBe(1);
      // The admin cannot mail it again.
      expect(decideAgeNotice(await readAgeNoticeTarget(prisma, id))).toMatchObject({ send: false });
    }
    // Unasked: possibly a child, so free text and usage go too.
    expect(await prisma.comment.count({ where: { userId: "pupil" } })).toBe(0);
    expect(await prisma.event.count({ where: { userId: "pupil" } })).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: "pupil" } })).displayName).toBe(
      "Name pupil",
    );
    // Said 18 or over: the address still goes, as the email said, but nothing else.
    expect(await prisma.comment.count({ where: { userId: "grownup" } })).toBe(1);
    expect(await prisma.event.count({ where: { userId: "grownup" } })).toBe(1);

    // Untouched.
    expect((await prisma.user.findUniqueOrThrow({ where: { id: "plain" } })).email).toBe(
      "someone@gmail.test",
    );
    expect((await prisma.user.findUniqueOrThrow({ where: { id: "answered" } })).email).toBe(
      "x@student.scusd.edu",
    );

    // Done once: the next run finds nothing, and the list is empty.
    expect(
      (await purgeChildData(prisma, later(AGE_NOTICE_GRACE_MS + 60 * 60 * 1000)))
        .noticedAddressesRemoved,
    ).toBe(0);
    expect(await loadAgeNoticeRows(prisma)).toEqual([]);
  });
});
