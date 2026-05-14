import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { FeedPlayer } from "@/components/FeedPlayer";

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
  staffAnswer: string;
  bboxJson: string | null;
  lat: number | null;
  lon: number | null;
};

export default async function FeedPage() {
  const snippets = await prisma.snippet.findMany({
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
    },
  });

  const feedSnippets = snippets.map((snippet: FeedSnippetRow) => ({
    id: snippet.id,
    videoUrl: snippet.videoUrl,
    thumbnailUrl: snippet.thumbnailUrl,
    site: snippet.site,
    deployment: snippet.deployment,
    staffAnswer: snippet.staffAnswer,
    bboxes: snippet.bboxJson ? JSON.parse(snippet.bboxJson) : null,
    lat: snippet.lat,
    lon: snippet.lon,
  }));

  return (
    <main id="main" className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface)]/84 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--primary)]">PEBL FishSpotter</p>
            <h1 className="font-brand-heading text-lg font-bold text-[color:var(--foreground)]">Recent sightings</h1>
          </div>
        <Link
          href="/feed/browse"
          className="pebl-button-secondary inline-flex items-center justify-center min-h-[44px] rounded-full px-4 py-2 text-sm font-medium"
        >
          View archive
        </Link>
        </div>
      </div>
      <FeedPlayer snippets={feedSnippets} />
    </main>
  );
}
