import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CATALOGUE } from "@/lib/idguide/catalogue";

export const dynamic = "force-dynamic";

type Tier = "verified" | "coarse" | "community";

function tierOf(staffAnswer: string | null): Tier {
  if (staffAnswer === null) return "community";
  return staffAnswer in CATALOGUE ? "verified" : "coarse";
}

const TIER_LABEL: Record<Tier, string> = {
  verified: "Verified species",
  coarse: "Group only",
  community: "Community",
};
const TIER_CLASS: Record<Tier, string> = {
  verified: "bg-teal-100 text-teal-800",
  coarse: "bg-amber-100 text-amber-800",
  community: "bg-navy-100 text-navy-700",
};

export default async function AdminSnippetsPage() {
  const snippets = await prisma.snippet.findMany({
    select: {
      id: true,
      externalId: true,
      thumbnailUrl: true,
      site: true,
      staffAnswer: true,
      _count: { select: { answers: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const counts = { verified: 0, coarse: 0, community: 0 };
  for (const s of snippets) counts[tierOf(s.staffAnswer)]++;

  return (
    <div>
      <h1 className="font-brand text-xl font-semibold text-navy-900">Snippet references</h1>
      <p className="mt-1 text-sm text-navy-600">
        Set a species reference where you can, or leave a clip as Community (no reference) so the
        crowd decides. Saving re-scores existing answers and unlocks the species for spotters who
        got it right.
      </p>
      <p className="mt-2 text-[12px] text-navy-500">
        {snippets.length} clips · {counts.verified} verified · {counts.coarse} group-only ·{" "}
        {counts.community} community
      </p>

      <ul className="mt-4 divide-y divide-navy-200/60 rounded-lg border border-navy-200/60 bg-white">
        {snippets.map((s) => {
          const tier = tierOf(s.staffAnswer);
          const common = s.staffAnswer && CATALOGUE[s.staffAnswer]?.commonName;
          return (
            <li key={s.id}>
              <Link
                href={`/admin/snippets/${s.id}`}
                className="flex items-center gap-3 px-3 py-2 hover:bg-navy-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- admin thumb */}
                <img
                  src={s.thumbnailUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded object-cover"
                  loading="lazy"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-navy-900">
                    {common || s.staffAnswer || "— no reference —"}
                  </span>
                  <span className="block truncate text-[11px] text-navy-500">{s.site}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TIER_CLASS[tier]}`}>
                  {TIER_LABEL[tier]}
                </span>
                <span className="w-12 shrink-0 text-right text-[11px] text-navy-500">
                  {s._count.answers} ans
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
