import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { bucketAnswersByNormalized } from "@/lib/answer-histogram";
import { SnippetReferenceEditor } from "./SnippetReferenceEditor";

export const dynamic = "force-dynamic";

export default async function AdminSnippetEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const snippet = await prisma.snippet.findUnique({
    where: { id },
    select: {
      id: true,
      externalId: true,
      videoUrl: true,
      thumbnailUrl: true,
      site: true,
      deployment: true,
      staffAnswer: true,
    },
  });
  if (!snippet) notFound();

  const answers = await prisma.answer.findMany({
    where: { snippetId: id },
    select: { chosenOption: true, isCorrect: true },
  });
  // Counts == distinct spotters (one answer per user per snippet).
  const breakdown = bucketAnswersByNormalized(answers).slice(0, 8);

  // Catalogue options for the picker, sorted by common name.
  const catalogue = Object.entries(CATALOGUE)
    .map(([scientificName, t]) => ({ scientificName, commonName: t.commonName }))
    .sort((a, b) => a.commonName.localeCompare(b.commonName));

  const currentIsCatalogue = snippet.staffAnswer ? snippet.staffAnswer in CATALOGUE : false;

  return (
    <div>
      <Link href="/admin/snippets" className="text-[12px] text-teal-600 hover:text-teal-700">
        &larr; All snippets
      </Link>
      <h1 className="mt-2 font-brand text-xl font-semibold text-navy-900">{snippet.site}</h1>
      <p className="text-[11px] text-navy-500">{snippet.externalId}</p>

      <div className="mt-4 grid gap-5 md:grid-cols-[260px_1fr]">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- admin uses video below; poster is the thumb */}
          <video
            src={snippet.videoUrl}
            poster={snippet.thumbnailUrl}
            controls
            playsInline
            className="aspect-[9/16] w-full rounded-lg bg-navy-900 object-cover"
          />
          <p className="mt-2 text-[11px] text-navy-500">{snippet.deployment}</p>
        </div>

        <div>
          <section className="rounded-lg border border-navy-200/60 bg-white p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-navy-500">
              What spotters said ({answers.length})
            </p>
            {breakdown.length === 0 ? (
              <p className="mt-2 text-sm text-navy-500">No answers yet.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {breakdown.map((b) => (
                  <li key={b.option} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-navy-800">{b.option}</span>
                    <span className="shrink-0 tabular-nums text-navy-500">{b.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="mt-4">
            <SnippetReferenceEditor
              snippetId={snippet.id}
              currentValue={currentIsCatalogue ? snippet.staffAnswer : null}
              currentRaw={snippet.staffAnswer}
              catalogue={catalogue}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
