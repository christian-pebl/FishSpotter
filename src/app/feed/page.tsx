import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { FeedPlayer } from "@/components/FeedPlayer";

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
    },
  });

  const feedSnippets = snippets.map((snippet) => ({
    id: snippet.id,
    videoUrl: snippet.videoUrl,
    thumbnailUrl: snippet.thumbnailUrl,
    site: snippet.site,
    deployment: snippet.deployment,
    staffAnswer: snippet.staffAnswer,
    bboxes: snippet.bboxJson ? JSON.parse(snippet.bboxJson) : null,
  }));

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="px-4 py-2 flex items-center justify-between border-b border-slate-700/50 bg-slate-900/50 shrink-0">
        <h1 className="text-lg font-bold text-cyan-400">Feed</h1>
        <Link
          href="/feed/browse"
          className="text-sm text-slate-300 hover:text-white"
        >
          Browse all
        </Link>
      </div>
      <FeedPlayer snippets={feedSnippets} />
    </div>
  );
}
