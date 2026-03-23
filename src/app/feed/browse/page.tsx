import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";

export default async function FeedBrowsePage() {
  const snippets = await prisma.snippet.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      externalId: true,
      thumbnailUrl: true,
      videoUrl: true,
      site: true,
      deployment: true,
      recordingDatetime: true,
    },
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
        <div className="pebl-surface rounded-[28px] px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--primary)]">Observation archive</p>
          <h1 className="mt-2 font-brand-heading text-3xl text-[color:var(--foreground)]">Browse the wider PEBL clip library</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
            Review archived sightings from marine monitoring deployments, open any clip, and add your identification to the community record.
          </p>
        </div>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {snippets.map((s: { id: string; thumbnailUrl: string; site: string; deployment: string }) => (
            <li key={s.id}>
              <Link
                href={`/feed/${s.id}`}
                className="pebl-surface block overflow-hidden rounded-[24px] transition hover:-translate-y-0.5 hover:border-[color:var(--primary)]"
              >
                <div className="relative aspect-video bg-[color:var(--surface-muted)]">
                  <Image
                    src={s.thumbnailUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
                <div className="space-y-1 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">PEBL sighting</p>
                  <p className="truncate text-base font-semibold text-[color:var(--foreground)]">{s.site}</p>
                  <p className="text-sm text-[color:var(--muted)]">{s.deployment}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        {snippets.length === 0 && (
          <p className="text-sm text-[color:var(--muted)]">No clips yet. Run the seed script to load marine monitoring snippets.</p>
        )}
      </main>
    </div>
  );
}
