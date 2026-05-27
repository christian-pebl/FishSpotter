import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FeedPlayer } from "@/components/FeedPlayer";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { orderFeed } from "@/lib/feed-ordering";

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
  const [snippets, session] = await Promise.all([
    prisma.snippet.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        videoUrl: true,
        thumbnailUrl: true,
        site: true,
        deployment: true,
        staffAnswer: true,
        bboxJson: true,
        lat: true,
        lon: true,
        depthM: true,
        recordingDatetime: true,
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

  const orderedSnippets = orderFeed(snippets, answeredIds, seed);

  let needsTour = false;
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboardedAt: true },
    });
    needsTour = !!user && user.onboardedAt === null;
  }

  const feedSnippets = orderedSnippets.map((snippet: FeedSnippetRow) => ({
    id: snippet.id,
    videoUrl: snippet.videoUrl,
    thumbnailUrl: snippet.thumbnailUrl,
    site: snippet.site,
    deployment: snippet.deployment,
    staffAnswer: snippet.staffAnswer,
    bboxes: snippet.bboxJson ? JSON.parse(snippet.bboxJson) : null,
    lat: snippet.lat,
    lon: snippet.lon,
    depthM: snippet.depthM,
    recordingDatetime: snippet.recordingDatetime,
  }));

  return (
    <main id="main" tabIndex={-1} className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <FeedPlayer snippets={feedSnippets} />
      <OnboardingTour needsTour={needsTour} />
    </main>
  );
}
