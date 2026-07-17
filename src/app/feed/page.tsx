import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FeedPlayer } from "@/components/FeedPlayer";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { VerificationBanner } from "@/components/VerificationBanner";
import { GuestGate } from "@/components/guest/GuestGate";
import { GuestSavePrompt } from "@/components/guest/GuestSavePrompt";
import { orderFeed } from "@/lib/feed-ordering";
import { readinessFromAnsweredCount } from "@/lib/difficulty";
import { safeParseJson } from "@/lib/safe-json";
import { excludeBlockedSnippetsWhere } from "@/lib/snippet-blocklist";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live feed",
};

type FeedSnippetRow = {
  id: string;
  videoUrl: string;
  thumbnailUrl: string;
  site: string;
  deployment: string;
  staffAnswer: string | null;
  bboxJson: string | null;
  manualTrackJson: string | null;
  lat: number | null;
  lon: number | null;
  depthM: number | null;
  recordingDatetime: string | null;
};

const ANON_SEED_COOKIE = "fs.anon_seed";

export default async function FeedPage() {
  // S8-T1: fetch snippets, session, AND the signed-in user's answered
  // snippet IDs in parallel. The third query is a no-op when the user
  // isn't signed in. createdAt-desc is the underlying order — orderFeed
  // shuffles on top of that, so any future tie-break (within the same
  // shuffle bucket) is stable on insert order.
  //
  // difficultyScore is fetched via $queryRaw rather than the typed select
  // above: this was wired in before the generated Prisma Client had been
  // regenerated for the new column (a native-binary lock from other
  // concurrent dev processes blocked `prisma generate`). Once regenerated,
  // fold `difficultyScore: true` into the select above and drop this query.
  const [snippets, session, difficultyRows] = await Promise.all([
    prisma.snippet.findMany({
      where: excludeBlockedSnippetsWhere(),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        videoUrl: true,
        thumbnailUrl: true,
        site: true,
        deployment: true,
        staffAnswer: true,
        bboxJson: true,
        manualTrackJson: true,
        lat: true,
        lon: true,
        depthM: true,
        recordingDatetime: true,
      },
    }),
    getServerSession(authOptions),
    prisma.$queryRaw<Array<{ id: string; difficultyScore: number }>>`
      SELECT id, "difficultyScore" FROM "Snippet"
    `,
  ]);
  const difficultyById = new Map(difficultyRows.map((r) => [r.id, r.difficultyScore]));

  // S8-T1: pick the shuffle seed + collect the user's answered IDs.
  // Seed = userId for signed-in users (stable across reloads, distinct
  // across users). Seed = `fs.anon_seed` cookie for anon visitors
  // (minted by src/middleware.ts on first request).
  let seed: string;
  let answeredIds = new Set<string>();
  if (session?.user?.id) {
    seed = session.user.id;
    const answers = await prisma.answer.findMany({
      where: { userId: session.user.id },
      select: { snippetId: true },
    });
    answeredIds = new Set(answers.map((a) => a.snippetId));
  } else {
    // Read the middleware-set cookie. Defensive fallback: if the cookie
    // is somehow missing (middleware miss / direct API hit), fall back
    // to a fixed string so the page doesn't 500 and ordering is at
    // least deterministic across the request.
    const cookieStore = cookies();
    seed = cookieStore.get(ANON_SEED_COOKIE)?.value ?? "anon-fallback";
  }

  // Difficulty ramp: brand-new spotters (readiness 0) get a feed skewed
  // toward easy, clear clips; readiness rises with clips answered, mixing
  // in harder/more cryptic ones (src/lib/difficulty.ts). Anonymous visitors
  // have no answer history to draw on, so they always start at readiness 0
  // — a reasonable default since a signed-out visitor is, by definition,
  // new to this browser's session.
  const readiness = readinessFromAnsweredCount(answeredIds.size);
  const snippetsWithDifficulty = snippets.map((s) => ({
    ...s,
    difficultyScore: difficultyById.get(s.id) ?? 0.5,
  }));
  const orderedSnippets = orderFeed(snippetsWithDifficulty, answeredIds, seed, { readiness });

  let needsTour = false;
  let unverified = false;
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboardedAt: true, emailVerified: true, isGuest: true },
    });
    needsTour = !!user && user.onboardedAt === null;
    // T5: nudge brand-new users to verify (they land here straight after signup
    // with no "check your inbox" confirmation). Guests have only a placeholder
    // email, so they're never nagged to verify it — they claim a real one via
    // the guest-save prompt instead.
    unverified = !!user && !user.isGuest && !user.emailVerified;
  }

  const feedSnippets = orderedSnippets.map((snippet: FeedSnippetRow) => ({
    id: snippet.id,
    videoUrl: snippet.videoUrl,
    thumbnailUrl: snippet.thumbnailUrl,
    site: snippet.site,
    deployment: snippet.deployment,
    staffAnswer: snippet.staffAnswer,
    bboxes: safeParseJson(snippet.bboxJson),
    manualTrack: safeParseJson(snippet.manualTrackJson),
    lat: snippet.lat,
    lon: snippet.lon,
    depthM: snippet.depthM,
    recordingDatetime: snippet.recordingDatetime,
  }));

  return (
    <main id="main" tabIndex={-1} className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <FeedPlayer snippets={feedSnippets} />
      <OnboardingTour needsTour={needsTour} />
      <VerificationBanner unverified={unverified} />
      {/* Zero-friction guest flow: username prompt for signed-out spotters,
          then an email-save nudge once a guest has spotted a few clips. Both
          self-gate on session state, so they no-op for signed-in users. */}
      <GuestGate />
      <GuestSavePrompt />
    </main>
  );
}
