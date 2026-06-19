import Link from "next/link";

const TILES = [
  {
    href: "/admin/snippets",
    title: "Clips & tracks",
    body: "Set each clip's species reference, and draw the fish-tracking overlay (the trail spotters follow) right on the video.",
  },
  {
    href: "/admin/species",
    title: "Species marks",
    body: "Author diagnostic marks — the labelled rings on a reference photo shown in the Help me identify wizard.",
  },
  {
    href: "/admin/metrics",
    title: "Impact metrics",
    body: "Aggregate reach, engagement and learning for funder reporting. Export a 90-day CSV.",
  },
];

export default function AdminHomePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-brand text-h2 text-navy-900">Admin tools</h1>
        <p className="pt-1 text-sm text-navy-600">
          Curate the clips, references and identification guidance shown to spotters.
        </p>
      </header>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((tile) => (
          <li key={tile.href}>
            <Link
              href={tile.href}
              className="flex h-full flex-col rounded-card border border-navy-200 bg-white p-4 transition hover:border-teal-500 hover:bg-teal-50"
            >
              <span className="flex items-center justify-between text-sm font-semibold text-navy-900">
                {tile.title}
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="text-teal-600">
                  <path d="M2.5 6h6M6 3l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="pt-1 text-[12px] leading-relaxed text-navy-600">{tile.body}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
