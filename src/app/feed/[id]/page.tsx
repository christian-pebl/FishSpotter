import Link from "next/link";
import { notFound } from "next/navigation";
import { SnippetPlayer } from "@/components/SnippetPlayer";
import { prisma } from "@/lib/prisma";

export default async function SnippetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await prisma.snippet.findUnique({ where: { id } });
  if (!row) notFound();
  const snippet = {
    id: row.id,
    videoUrl: row.videoUrl,
    thumbnailUrl: row.thumbnailUrl,
    site: row.site,
    deployment: row.deployment,
    depthM: row.depthM,
    recordingDatetime: row.recordingDatetime,
    staffAnswer: row.staffAnswer,
    bboxes: row.bboxJson ? JSON.parse(row.bboxJson) : null,
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-4">
        <p className="mb-4">
          <Link href="/feed" className="text-cyan-400 hover:underline">← Feed</Link>
        </p>
        <SnippetPlayer snippet={snippet} />
      </main>
    </div>
  );
}
