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
    labelStatus: row.labelStatus,
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">
        <p className="mb-4">
          <Link href="/feed" className="pebl-button-secondary inline-flex rounded-full px-4 py-2 text-sm font-medium">← Back to live feed</Link>
        </p>
        <SnippetPlayer snippet={snippet} />
      </main>
    </div>
  );
}
