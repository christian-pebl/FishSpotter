/**
 * Integration tests for the stats roundup against a REAL Postgres.
 *
 * `roundup.test.ts` covers whatever is pure; this covers what only a real
 * database proves: the `distinct` / `groupBy` / `aggregate` queries actually
 * translate to correct SQL, and the in-memory First-Sighting / contested-clip
 * logic sees the same row shapes Postgres returns (Prisma's Decimal/Date
 * handling, `distinct` semantics) rather than a hand-rolled fixture.
 *
 * Skipped unless METRICS_TEST_DATABASE_URL points at a throwaway database
 * with the schema pushed, so CI and normal `npm test` runs are unaffected,
 * same convention as src/lib/prize-desk.integration.test.ts:
 *
 *   createdb fishspotter_test
 *   POSTGRES_PRISMA_URL=postgresql://.../fishspotter_test \
 *   POSTGRES_URL_NON_POOLING=postgresql://.../fishspotter_test \
 *     npx prisma db push
 *   METRICS_TEST_DATABASE_URL=postgresql://.../fishspotter_test npm test
 *
 * The database is TRUNCATED between tests, never point this at anything real.
 */

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { computeRoundup } from "./roundup";

const url = process.env.METRICS_TEST_DATABASE_URL;
const prisma = url
  ? new PrismaClient({ datasources: { db: { url } } })
  : (null as unknown as PrismaClient);

const NOW = new Date("2026-08-01T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

let snippetCounter = 0;
let userCounter = 0;

async function seedUser(opts: { isGuest?: boolean; verified?: boolean; createdAt?: Date } = {}) {
  userCounter++;
  return prisma.user.create({
    data: {
      email: `user${userCounter}@example.test`,
      isGuest: opts.isGuest ?? false,
      emailVerified: opts.verified === false ? null : NOW,
      createdAt: opts.createdAt ?? NOW,
    },
  });
}

async function seedSnippet(opts: { excluded?: boolean; createdAt?: Date } = {}) {
  snippetCounter++;
  return prisma.snippet.create({
    data: {
      externalId: `roundup-test-${snippetCounter}`,
      videoUrl: "https://example.test/v.mp4",
      thumbnailUrl: "https://example.test/t.jpg",
      site: "Test site",
      deployment: "D1",
      excluded: opts.excluded ?? false,
      createdAt: opts.createdAt ?? NOW,
    },
  });
}

async function seedAnswer(opts: {
  userId: string;
  snippetId: string;
  chosenOption: string;
  createdAt: Date;
  points?: number;
  isCorrect?: boolean | null;
}) {
  return prisma.answer.create({
    data: {
      userId: opts.userId,
      snippetId: opts.snippetId,
      chosenOption: opts.chosenOption,
      points: opts.points ?? 5,
      isCorrect: opts.isCorrect ?? null,
      createdAt: opts.createdAt,
    },
  });
}

describe.skipIf(!url)("computeRoundup (integration)", () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Answer","Event","ConsensusEvent","UnlockedSpecies","PebblePurchase","Vital","Snippet","User" RESTART IDENTITY CASCADE',
    );
    snippetCounter = 0;
    userCounter = 0;
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it("counts a clip with zero answers as unspotted, not as a first sighting", async () => {
    await seedSnippet();
    const r = await computeRoundup(prisma, { now: NOW });
    expect(r.discovery.liveClips).toBe(1);
    expect(r.discovery.firstSightingsAwarded).toBe(0);
    expect(r.discovery.unspottedClips).toBe(1);
  });

  it("excludes excluded clips from both the live denominator and the backlog", async () => {
    await seedSnippet({ excluded: true });
    await seedSnippet(); // one live, unspotted
    const r = await computeRoundup(prisma, { now: NOW });
    expect(r.discovery.liveClips).toBe(1);
    expect(r.discovery.unspottedClips).toBe(1);
    expect(r.content.excludedClips).toBe(1);
  });

  it("credits First Sighting to the earliest answer, not creation order", async () => {
    const snippet = await seedSnippet();
    const early = await seedUser();
    const later = await seedUser();
    // Insert the LATER user's row first to prove ordering comes from
    // createdAt, not insertion/PK order.
    await seedAnswer({
      userId: later.id,
      snippetId: snippet.id,
      chosenOption: "Pollachius pollachius",
      createdAt: new Date(NOW.getTime() + 2 * 60 * 60 * 1000),
    });
    await seedAnswer({
      userId: early.id,
      snippetId: snippet.id,
      chosenOption: "Labrus bergylta",
      createdAt: new Date(NOW.getTime() + 1 * 60 * 60 * 1000),
    });

    const r = await computeRoundup(prisma, { now: NOW });
    expect(r.discovery.firstSightingsAwarded).toBe(1);
    expect(r.discovery.distinctFirstSpotters).toBe(1);
    // Both spotters answered, so this clip reached the "two" taper slot.
    expect(r.discovery.slotFill.two).toBe(1);
    expect(r.discovery.slotFill.one).toBe(0);
  });

  it("does not double-count a re-guess as a second spotter or a second Pebble award", async () => {
    // Answer carries @@unique([userId, snippetId]); the real route
    // (POST /api/answers) re-guesses via upsert().update, changing
    // chosenOption in place rather than inserting a second row, so a
    // second `create()` here would itself be the bug this test guards
    // against (caught by the DB constraint the first time this test was
    // written with two `create()` calls). Model the upsert directly.
    const snippet = await seedSnippet();
    const user = await seedUser();
    await seedAnswer({
      userId: user.id,
      snippetId: snippet.id,
      chosenOption: "Pollachius pollachius",
      createdAt: NOW,
    });
    await prisma.answer.update({
      where: { userId_snippetId: { userId: user.id, snippetId: snippet.id } },
      data: { chosenOption: "Pollachius pollachius (corrected)" },
    });

    const r = await computeRoundup(prisma, { now: NOW });
    expect(r.discovery.slotFill.one).toBe(1);
    expect(r.discovery.slotFill.two).toBe(0);
    // Base(5) + First-Sighting bonus(25) once, not twice.
    expect(r.discovery.discoveryPebbles).toBe(30);
  });

  it("computes the [25, 12, 6] taper across three distinct spotters", async () => {
    const snippet = await seedSnippet();
    const [a, b, c] = await Promise.all([seedUser(), seedUser(), seedUser()]);
    await seedAnswer({ userId: a.id, snippetId: snippet.id, chosenOption: "X", createdAt: NOW });
    await seedAnswer({
      userId: b.id,
      snippetId: snippet.id,
      chosenOption: "X",
      createdAt: new Date(NOW.getTime() + 1000),
    });
    await seedAnswer({
      userId: c.id,
      snippetId: snippet.id,
      chosenOption: "X",
      createdAt: new Date(NOW.getTime() + 2000),
    });

    const r = await computeRoundup(prisma, { now: NOW });
    expect(r.discovery.slotFill.threePlus).toBe(1);
    // (5+25) + (5+12) + (5+6) = 58
    expect(r.discovery.discoveryPebbles).toBe(58);
  });

  it("marks a clip eligible for consensus only once 3 distinct spotters have answered", async () => {
    const snippet = await seedSnippet();
    const [a, b] = await Promise.all([seedUser(), seedUser()]);
    await seedAnswer({ userId: a.id, snippetId: snippet.id, chosenOption: "X", createdAt: NOW });
    await seedAnswer({
      userId: b.id,
      snippetId: snippet.id,
      chosenOption: "Y",
      createdAt: new Date(NOW.getTime() + 1000),
    });

    let r = await computeRoundup(prisma, { now: NOW });
    expect(r.community.clipsEligibleForConsensus).toBe(0);

    const c = await seedUser();
    await seedAnswer({
      userId: c.id,
      snippetId: snippet.id,
      chosenOption: "Z",
      createdAt: new Date(NOW.getTime() + 2000),
    });

    r = await computeRoundup(prisma, { now: NOW });
    expect(r.community.clipsEligibleForConsensus).toBe(1);
  });

  it("flags a genuinely split clip as contested", async () => {
    const snippet = await seedSnippet();
    const users = await Promise.all([seedUser(), seedUser(), seedUser(), seedUser()]);
    // 2 vs 2 on a 4-spotter clip: even split, well within the contested band.
    const options = ["Pollachius pollachius", "Pollachius pollachius", "Labrus bergylta", "Labrus bergylta"];
    await Promise.all(
      users.map((u, i) =>
        seedAnswer({
          userId: u.id,
          snippetId: snippet.id,
          chosenOption: options[i],
          createdAt: new Date(NOW.getTime() + i * 1000),
        }),
      ),
    );

    const r = await computeRoundup(prisma, { now: NOW });
    expect(r.community.contestedClips).toBe(1);
  });

  it("computes reach counts (registered/guest/verified) with real DISTINCT and groupBy queries", async () => {
    await seedUser({ isGuest: false, verified: true });
    await seedUser({ isGuest: false, verified: false });
    await seedUser({ isGuest: true });

    const r = await computeRoundup(prisma, { now: NOW });
    expect(r.reach.totalUsers).toBe(3);
    expect(r.reach.registered).toBe(2);
    expect(r.reach.guests).toBe(1);
    expect(r.reach.verified).toBe(1);
  });

  it("counts a spotter who answered on only one day as not returning", async () => {
    const snippet = await seedSnippet();
    const user = await seedUser();
    await seedAnswer({ userId: user.id, snippetId: snippet.id, chosenOption: "X", createdAt: NOW });

    const r = await computeRoundup(prisma, { now: NOW });
    expect(r.retention.spottersWithAnyId).toBe(1);
    expect(r.retention.spottersWithMoreThanOneDay).toBe(0);
    expect(r.retention.returnRate).toBe(0);
  });

  it("counts a spotter active on two distinct days as returning", async () => {
    const s1 = await seedSnippet();
    const s2 = await seedSnippet();
    const user = await seedUser();
    await seedAnswer({ userId: user.id, snippetId: s1.id, chosenOption: "X", createdAt: NOW });
    await seedAnswer({
      userId: user.id,
      snippetId: s2.id,
      chosenOption: "Y",
      createdAt: new Date(NOW.getTime() - DAY_MS),
    });

    const r = await computeRoundup(prisma, { now: NOW });
    expect(r.retention.spottersWithMoreThanOneDay).toBe(1);
    expect(r.retention.returnRate).toBe(1);
  });

  it("returns null medians and shares on an empty database rather than throwing or dividing by zero", async () => {
    const r = await computeRoundup(prisma, { now: NOW });
    expect(r.discovery.medianTimeToFirstSpotMs).toBeNull();
    expect(r.discovery.top5FirstSpotShare).toBeNull();
    expect(r.engagement.viewToIdConversion).toBeNull();
    expect(r.retention.returnRate).toBeNull();
    expect(r.learning.consensusAccuracy).toBeNull();
  });
});
