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
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        <h1 className="text-2xl font-bold mb-4">Browse all clips</h1>
        <p className="text-slate-400 mb-6">
          Tap a clip to watch and answer: What is this creature?
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {snippets.map((s: { id: string; thumbnailUrl: string; site: string; deployment: string }) => (
            <li key={s.id}>
              <Link
                href={`/feed/${s.id}`}
                className="block rounded-xl overflow-hidden border border-slate-700/50 bg-slate-800/30 hover:border-cyan-500/50 transition"
              >
                <div className="aspect-video relative bg-slate-800">
                  <Image
                    src={s.thumbnailUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium truncate">{s.site}</p>
                  <p className="text-xs text-slate-500">{s.deployment}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        {snippets.length === 0 && (
          <p className="text-slate-500">No clips yet. Run the seed script to load snippets.</p>
        )}
      </main>
    </div>
  );
}
