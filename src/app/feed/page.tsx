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
import { countNewClipsSince, newClipBaseline } from "@/lib/new-clips";
import type { FeedCompleteProps } from "@/components/feed/FeedComplete";

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
  lat: number | null;
  lon: number | null;
  depthM: number | null;
  recordingDatetime: string | null;
};

const ANON_SEED_COOKIE = "fs.anon_seed";

/** How many cards ship with their tracking JSON already inlined.
 *
 *  The per-frame bbox/manual-track blobs are by far the heaviest thing in this
 *  page's payload (measured 29 Aug 2026: 1.43 MB of HTML, against 202 KB for
 *  /feed/browse, which carries none). FeedPlayer lazy-loads the rest from
 *  /api/snippets/[id]/bbox as each card enters its ±1 window, an endpoint that
 *  was built for exactly this and had no caller.
 *
 *  It is not zero because the OPENING card must not pop: its track sets the
 *  cover-crop anchor (speciesCenter in FeedCard), so fetching it a beat late
 *  would visibly re-centre a landscape clip. Three covers the initial ±1
 *  window plus one card of scroll headroom. */
const INLINE_TRACK_COUNT = 3;

export default async function FeedPage() {
  // S8-T1: fetch snippets, session, AND the signed-in user's answered
  // snippet IDs in parallel. The third query is a no-op when the user
  // isn't signed in. createdAt-desc is the underlying order, orderFeed
  // shuffles on top of that, so any future tie-break (within the same
  // shuffle bucket) is stable on insert order.
  //
  // difficultyScore now rides the typed select. It used to need a second
  // `SELECT id, "difficultyScore" FROM "Snippet"` via $queryRaw, because the
  // column was added while a native-binary lock from concurrent dev processes
  // blocked `prisma generate`. The client has since been regenerated, so that
  // stopgap (a whole second unindexed full-table scan on the app's busiest
  // route, on every request) is gone.
  const [snippets, session] = await Promise.all([
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
        lat: true,
        lon: true,
        depthM: true,
        recordingDatetime: true,
        difficultyScore: true,
      },
    }),
    getServerSession(authOptions),
  ]);

  // S8-T1: pick the shuffle seed + collect the user's answered IDs.
  // Seed = userId for signed-in users (stable across reloads, distinct
  // across users). Seed = `fs.anon_seed` cookie for anon visitors
  // (minted by src/middleware.ts on first request).
  let seed: string;
  let answeredIds = new Set<string>();
  let pebbleTotal = 0;
  if (session?.user?.id) {
    seed = session.user.id;
    const answers = await prisma.answer.findMany({
      where: { userId: session.user.id },
      // points rides along for the end-of-feed card's Pebble total, which
      // would otherwise need a second aggregate over the same rows.
      select: { snippetId: true, points: true },
    });
    answeredIds = new Set(answers.map((a) => a.snippetId));
    pebbleTotal = answers.reduce((sum, a) => sum + a.points, 0);
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
  //, a reasonable default since a signed-out visitor is, by definition,
  // new to this browser's session.
  const readiness = readinessFromAnsweredCount(answeredIds.size);
  const orderedSnippets = orderFeed(snippets, answeredIds, seed, { readiness });

  let needsTour = false;
  let unverified = false;
  // End-of-feed + new-clip notification state (2026-08-13). Only meaningful for
  // a signed-in spotter: a signed-out visitor has no server-side answer history,
  // so they can neither clear the feed nor have a "last visit" to measure from.
  let unansweredCount: number | undefined;
  let completion: FeedCompleteProps | undefined;
  let newClipCount = 0;
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        onboardedAt: true,
        emailVerified: true,
        isGuest: true,
        newClipsOptIn: true,
        lastFeedSeenAt: true,
        createdAt: true,
      },
    });
    // Counted against the SERVED snippet list, not the raw answer count: a
    // spotter may hold answers on clips that have since been excluded from the
    // feed, and those must not make the feed look finished when it isn't.
    unansweredCount = snippets.filter((s) => !answeredIds.has(s.id)).length;
    if (user) {
      completion = {
        totalClips: snippets.length,
        pebbles: pebbleTotal,
        notifyOptIn: user.newClipsOptIn,
        // A guest holds a placeholder address and an unverified user's may
        // belong to someone else, so neither can be mailed. The card offers
        // verification instead of a checkbox that would never fire.
        canReceiveEmail: !user.isGuest && !!user.emailVerified,
      };
      newClipCount = await countNewClipsSince(prisma, newClipBaseline(user));
    }
    needsTour = !!user && user.onboardedAt === null;
    // T5: nudge brand-new users to verify (they land here straight after signup
    // with no "check your inbox" confirmation). Guests have only a placeholder
    // email, so they're never nagged to verify it, they claim a real one via
    // the guest-save prompt instead.
    unverified = !!user && !user.isGuest && !user.emailVerified;
  }

  // Pull the tracking JSON for the opening cards ONLY (see INLINE_TRACK_COUNT).
  // Indexed lookup on 3 ids, so it costs far less than carrying every snippet's
  // per-frame blob through the HTML did.
  const inlineIds = orderedSnippets.slice(0, INLINE_TRACK_COUNT).map((s) => s.id);
  const inlineTrackRows = inlineIds.length
    ? await prisma.snippet.findMany({
        where: { id: { in: inlineIds } },
        select: { id: true, bboxJson: true, manualTrackJson: true },
      })
    : [];
  const inlineTrackById = new Map(inlineTrackRows.map((r) => [r.id, r]));

  const feedSnippets = orderedSnippets.map((snippet: FeedSnippetRow) => {
    const track = inlineTrackById.get(snippet.id);
    return {
      id: snippet.id,
      videoUrl: snippet.videoUrl,
      thumbnailUrl: snippet.thumbnailUrl,
      site: snippet.site,
      deployment: snippet.deployment,
      staffAnswer: snippet.staffAnswer,
      // null here is "not loaded yet", not "no track". FeedPlayer fetches it
      // when the card comes into range; a snippet with genuinely no track
      // resolves to null again and renders exactly as it does today.
      bboxes: track ? safeParseJson(track.bboxJson) : null,
      manualTrack: track ? safeParseJson(track.manualTrackJson) : null,
      lat: snippet.lat,
      lon: snippet.lon,
      depthM: snippet.depthM,
      recordingDatetime: snippet.recordingDatetime,
    };
  });

  return (
    <main id="main" tabIndex={-1} className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <FeedPlayer
        snippets={feedSnippets}
        unansweredCount={unansweredCount}
        completion={completion}
        newClipCount={newClipCount}
      />
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
