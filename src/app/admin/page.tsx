import Link from "next/link";

export default function AdminHomePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-brand text-h2 text-navy-900">Admin tools</h1>
        <p className="pt-1 text-sm text-navy-600">
          Curate the species catalogue and identification guidance shown to spotters.
        </p>
      </header>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <li>
          <Link
            href="/admin/species"
            className="block rounded-card border border-navy-200 bg-white p-4 transition hover:border-teal-500 hover:bg-teal-50"
          >
            <h2 className="text-sm font-semibold text-navy-900">Species catalogue</h2>
            <p className="pt-1 text-[12px] text-navy-600">
              Author diagnostic marks (the click-a-feature reference photos shown in the Help me identify wizard).
            </p>
          </Link>
        </li>
      </ul>
    </div>
  );
}
