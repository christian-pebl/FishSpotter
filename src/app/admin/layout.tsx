import Link from "next/link";
import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin · FishSpotter",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireAdminSession();

  return (
    <div className="flex min-h-screen flex-col bg-navy-50">
      <header className="border-b border-navy-200/60 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="font-brand text-sm font-semibold text-navy-900">
              FishSpotter admin
            </Link>
            <nav className="flex items-center gap-3 text-[12px] text-navy-700">
              <Link href="/admin/species" className="hover:text-navy-900">
                Species
              </Link>
              <Link href="/admin/snippets" className="hover:text-navy-900">
                Snippets
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-navy-600">
            <span>{email}</span>
            <Link href="/feed" className="text-teal-600 hover:text-teal-700">
              Back to app
            </Link>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
