/**
 * Integration tests for the prize fulfilment desk against a REAL Postgres.
 *
 * The pure decision table lives in prize.test.ts; this covers what only a real
 * database can: the groupBy/join pipeline that decides who PEBL owes a book,
 * and the fulfilment write. Money (a posted book) rides on both.
 *
 * Skipped unless PRIZE_TEST_DATABASE_URL points at a throwaway database with
 * the schema pushed, so CI and normal `npm test` runs are unaffected:
 *
 *   createdb fishspotter_test
 *   POSTGRES_PRISMA_URL=postgresql://.../fishspotter_test \
 *   POSTGRES_URL_NON_POOLING=postgresql://.../fishspotter_test \
 *     npx prisma db push
 *   PRIZE_TEST_DATABASE_URL=postgresql://.../fishspotter_test npm test
 *
 * The database is TRUNCATED between tests, never point this at anything real.
 */

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PRIZE_TARGET_PEBBLES, SEASEARCH_GUIDE_ID } from "./prize";
import { loadPrizeWinnerRows, markPrizeFulfilled } from "./prize-desk";

const url = process.env.PRIZE_TEST_DATABASE_URL;
const prisma = url
  ? new PrismaClient({ datasources: { db: { url } } })
  : (null as unknown as PrismaClient);

const NOW = new Date("2026-08-01T12:00:00Z");
// Old enough to clear the account-age gate, with answers spread over enough
// days to clear the activity-spread gate.
const LONG_AGO = new Date("2026-01-01T00:00:00Z");

let snippetId: string;

async function seedUser(opts: {
  id: string;
  email: string;
  isGuest?: boolean;
  verified?: boolean;
  displayName?: string | null;
  pebbles?: number;
  /** How many distinct days of answers to write (spread weekly). */
  answerDays?: number;
  trustScore?: number;
}) {
  await prisma.user.create({
    data: {
      id: opts.id,
      email: opts.email,
      isGuest: opts.isGuest ?? false,
      emailVerified: opts.verified === false ? null : LONG_AGO,
      displayName: opts.displayName ?? null,
      createdAt: LONG_AGO,
      trustScore: opts.trustScore ?? 100,
    },
  });

  const days = opts.answerDays ?? 6;
  const total = opts.pebbles ?? 0;
  if (total > 0 || days > 0) {
    // Spread the points across the answers so the desk has to SUM them, not
    // read one row, the bug this guards is summing wrong, not fetching wrong.
    const per = Math.floor(total / days);
    const remainder = total - per * days;
    for (let i = 0; i < days; i++) {
      const snip = await prisma.snippet.create({
        data: {
          externalId: `${opts.id}-snip-${i}`,
          videoUrl: "https://example.test/v.mp4",
          thumbnailUrl: "https://example.test/t.jpg",
          site: "Test",
          deployment: "D1",
        },
      });
      snippetId = snip.id;
      await prisma.answer.create({
        data: {
          userId: opts.id,
          snippetId: snip.id,
          chosenOption: "Pollachius pollachius",
          points: i === 0 ? per + remainder : per,
          createdAt: new Date(LONG_AGO.getTime() + i * 7 * 24 * 3600 * 1000),
        },
      });
    }
  }
}

async function seedClaim(userId: string, opts: { fulfilled?: boolean } = {}) {
  await prisma.pebblePurchase.create({
    data: {
      userId,
      itemId: SEASEARCH_GUIDE_ID,
      pebbleCost: 0,
      purchasedAt: new Date("2026-07-25T00:00:00Z"),
      fulfilledAt: opts.fulfilled ? new Date("2026-07-26T00:00:00Z") : null,
      fulfilledBy: opts.fulfilled ? "ops@pebl-cic.co.uk" : null,
    },
  });
}

describe.skipIf(!url)("prize desk (integration)", () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Answer","PebblePurchase","Snippet","User" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it("excludes a spotter one Pebble short of the target", async () => {
    await seedUser({ id: "u1", email: "a@x.test", pebbles: PRIZE_TARGET_PEBBLES - 1 });
    expect(await loadPrizeWinnerRows(prisma, NOW)).toHaveLength(0);
  });

  it("includes a spotter exactly at the target, summing across answers", async () => {
    await seedUser({
      id: "u1",
      email: "a@x.test",
      displayName: "Reef",
      pebbles: PRIZE_TARGET_PEBBLES,
    });
    const rows = await loadPrizeWinnerRows(prisma, NOW);
    expect(rows).toHaveLength(1);
    // The sum must come back exact, a rounding slip here posts a book to
    // someone who never earned it (or withholds one from someone who did).
    expect(rows[0].pebbles).toBe(PRIZE_TARGET_PEBBLES);
    expect(rows[0].spotter).toBe("Reef");
    expect(rows[0].status).toBe("reached-unclaimed");
    expect(rows[0].contactEmail).toBe("a@x.test");
  });

  it("never exposes a guest's placeholder address as a contact", async () => {
    await seedUser({
      id: "guest1",
      email: "guest-9f3a@fishspotter.local",
      isGuest: true,
      verified: false,
      pebbles: 5000,
    });
    const [row] = await loadPrizeWinnerRows(prisma, NOW);
    expect(row.status).toBe("unreachable");
    expect(row.contactEmail).toBeNull();
    expect(row.contact).toBe("guest");
  });

  it("surfaces a claimed-but-unposted guide as the work queue", async () => {
    await seedUser({ id: "u1", email: "a@x.test", pebbles: 3000 });
    await seedClaim("u1");
    const [row] = await loadPrizeWinnerRows(prisma, NOW);
    expect(row.status).toBe("to-post");
    expect(row.claimedAt?.toISOString()).toBe("2026-07-25T00:00:00.000Z");
    expect(row.fulfilledAt).toBeNull();
  });

  it("shows a posted guide with who sent it", async () => {
    await seedUser({ id: "u1", email: "a@x.test", pebbles: 3000 });
    await seedClaim("u1", { fulfilled: true });
    const [row] = await loadPrizeWinnerRows(prisma, NOW);
    expect(row.status).toBe("posted");
    expect(row.fulfilledBy).toBe("ops@pebl-cic.co.uk");
  });

  it("keeps a claimant with zero answers on the desk", async () => {
    // Defensive: a claim without any Answer rows must not crash the groupBy
    // join or silently vanish, PEBL still owes them a book.
    await seedUser({ id: "u1", email: "a@x.test", pebbles: 0, answerDays: 0 });
    await seedClaim("u1");
    const rows = await loadPrizeWinnerRows(prisma, NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0].pebbles).toBe(0);
    expect(rows[0].status).toBe("to-post");
  });

  it("orders the desk by work-to-do, then Pebbles descending", async () => {
    await seedUser({ id: "posted", email: "p@x.test", pebbles: 9000 });
    await seedClaim("posted", { fulfilled: true });
    await seedUser({ id: "topost", email: "t@x.test", pebbles: 2000 });
    await seedClaim("topost");
    await seedUser({ id: "guest", email: "g@fishspotter.local", isGuest: true, pebbles: 8000 });
    await seedUser({ id: "hi", email: "h@x.test", pebbles: 5000 });
    await seedUser({ id: "lo", email: "l@x.test", pebbles: 2100 });

    const rows = await loadPrizeWinnerRows(prisma, NOW);
    expect(rows.map((r) => r.userId)).toEqual(["topost", "hi", "lo", "guest", "posted"]);
  });

  it("flags an unverified address but still shows it", async () => {
    await seedUser({ id: "u1", email: "real@x.test", verified: false, pebbles: 2500 });
    const [row] = await loadPrizeWinnerRows(prisma, NOW);
    expect(row.contact).toBe("unverified");
    expect(row.contactEmail).toBe("real@x.test");
    // The claim gate requires a verified email, so this row must not read as
    // eligible, otherwise the desk would invite posting to an unconfirmed
    // address.
    expect(row.eligible).toBe(false);
    expect(row.eligibilityReasons).toContain("email not verified");
  });

  describe("markPrizeFulfilled", () => {
    it("stamps the posted marker with the acting admin, then undoes it", async () => {
      await seedUser({ id: "u1", email: "a@x.test", pebbles: 3000 });
      await seedClaim("u1");

      const marked = await markPrizeFulfilled(prisma, "u1", true, "chris@pebl-cic.co.uk");
      expect(marked.fulfilledAt).toBeInstanceOf(Date);
      expect(marked.fulfilledBy).toBe("chris@pebl-cic.co.uk");
      expect((await loadPrizeWinnerRows(prisma, NOW))[0].status).toBe("posted");

      const undone = await markPrizeFulfilled(prisma, "u1", false, "chris@pebl-cic.co.uk");
      expect(undone.fulfilledAt).toBeNull();
      expect(undone.fulfilledBy).toBeNull();
      expect((await loadPrizeWinnerRows(prisma, NOW))[0].status).toBe("to-post");
    });

    it("refuses to stamp a spotter who never claimed", async () => {
      await seedUser({ id: "u1", email: "a@x.test", pebbles: 3000 });
      await expect(
        markPrizeFulfilled(prisma, "u1", true, "chris@pebl-cic.co.uk"),
      ).rejects.toThrow(/hasn't claimed/);
    });

    it("never stamps a retired shop purchase as a posted prize", async () => {
      // The ledger holds historic cosmetics; itemId scoping is the only thing
      // stopping a Tide Freeze from being marked as a posted book.
      await seedUser({ id: "u1", email: "a@x.test", pebbles: 3000 });
      await prisma.pebblePurchase.create({
        data: { userId: "u1", itemId: "tide-freeze", pebbleCost: 50 },
      });

      await expect(
        markPrizeFulfilled(prisma, "u1", true, "chris@pebl-cic.co.uk"),
      ).rejects.toThrow(/hasn't claimed/);

      const freeze = await prisma.pebblePurchase.findFirstOrThrow({
        where: { itemId: "tide-freeze" },
      });
      expect(freeze.fulfilledAt).toBeNull();
    });

    it("stamps only the guide when a spotter also holds shop purchases", async () => {
      await seedUser({ id: "u1", email: "a@x.test", pebbles: 3000 });
      await prisma.pebblePurchase.create({
        data: { userId: "u1", itemId: "gold-nameplate", pebbleCost: 200 },
      });
      await seedClaim("u1");

      await markPrizeFulfilled(prisma, "u1", true, "chris@pebl-cic.co.uk");

      const nameplate = await prisma.pebblePurchase.findFirstOrThrow({
        where: { itemId: "gold-nameplate" },
      });
      expect(nameplate.fulfilledAt).toBeNull();
      const guide = await prisma.pebblePurchase.findFirstOrThrow({
        where: { itemId: SEASEARCH_GUIDE_ID },
      });
      expect(guide.fulfilledAt).not.toBeNull();
    });
  });

  /**
   * Deploy-order safety. A Vercel deploy of new code lands BEFORE anyone runs
   * `prisma db push`, so for a few minutes the running code talks to a database
   * that lacks the newest columns. Any Prisma write without an explicit
   * `select` emits `RETURNING <every scalar column>` and 500s in that window.
   *
   * On 1 Aug 2026 that took out POST /api/prize/claim (the claim button) and
   * the Tide Freeze spend inside POST /api/answers. These tests drop the two
   * columns, replay the exact query shapes from those paths, and put the
   * columns back, so a future `select`-less write is caught here rather than
   * in production.
   */
  describe("survives a pre-migration database (deploy-order safety)", () => {
    async function withoutFulfilmentColumns(fn: () => Promise<void>) {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "PebblePurchase" DROP COLUMN "fulfilledAt", DROP COLUMN "fulfilledBy"',
      );
      try {
        await fn();
      } finally {
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "PebblePurchase" ADD COLUMN "fulfilledAt" TIMESTAMP(3), ADD COLUMN "fulfilledBy" TEXT',
        );
      }
    }

    it("POST /api/prize/claim can still record a claim", async () => {
      await seedUser({ id: "u1", email: "a@x.test", pebbles: 2500 });
      await withoutFulfilmentColumns(async () => {
        const created = await prisma.pebblePurchase.create({
          data: { userId: "u1", itemId: SEASEARCH_GUIDE_ID, pebbleCost: 0 },
          select: { id: true },
        });
        expect(created.id).toBeTruthy();
      });
    });

    it("settleStreak can still spend a Tide Freeze", async () => {
      await seedUser({ id: "u1", email: "a@x.test", pebbles: 100 });
      const freeze = await prisma.pebblePurchase.create({
        data: { userId: "u1", itemId: "tide-freeze", pebbleCost: 50 },
        select: { id: true },
      });
      await withoutFulfilmentColumns(async () => {
        const updated = await prisma.pebblePurchase.update({
          where: { id: freeze.id },
          data: { consumedForDate: "2026-08-01" },
          select: { id: true },
        });
        expect(updated.id).toBe(freeze.id);
      });
    });
  });

  it("does not treat a shop-only purchaser as a prize claimant", async () => {
    await seedUser({ id: "u1", email: "a@x.test", pebbles: 100 });
    await prisma.pebblePurchase.create({
      data: { userId: "u1", itemId: "tide-freeze", pebbleCost: 50 },
    });
    expect(await loadPrizeWinnerRows(prisma, NOW)).toHaveLength(0);
    expect(snippetId).toBeDefined();
  });
});
