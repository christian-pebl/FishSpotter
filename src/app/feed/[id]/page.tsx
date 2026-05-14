import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SnippetPlayer } from "@/components/SnippetPlayer";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const row = await prisma.snippet.findUnique({ where: { id }, select: { site: true, deployment: true } });
  if (!row) return { title: "Sighting" };
  return { title: `${row.site} · ${row.deployment}` };
}

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
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <main id="main" className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">
        <p className="mb-4">
          <Link href="/feed" className="pebl-button-secondary inline-flex items-center justify-center min-h-[44px] rounded-full px-4 py-2 text-sm font-medium">← Back to live feed</Link>
        </p>
        <SnippetPlayer snippet={snippet} />
      </main>
    </div>
  );
}
