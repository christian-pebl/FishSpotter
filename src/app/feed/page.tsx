import type { Metadata } from "next";
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
  depthM: number | null;
  recordingDatetime: string | null;
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
      depthM: true,
      recordingDatetime: true,
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
    depthM: snippet.depthM,
    recordingDatetime: snippet.recordingDatetime,
  }));

  return (
    <main id="main" tabIndex={-1} className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <FeedPlayer snippets={feedSnippets} />
    </main>
  );
}
