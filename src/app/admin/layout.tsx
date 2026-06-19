import Link from "next/link";
import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin";
import { AdminNav } from "./AdminNav";

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
        <div className="mx-auto w-full max-w-6xl px-4 pt-3">
          <div className="flex items-center justify-between gap-3">
            <Link href="/admin" className="font-brand text-sm font-semibold text-navy-900">
              FishSpotter admin
            </Link>
            <div className="flex min-w-0 items-center gap-3 text-[11px] text-navy-600">
              <span className="hidden max-w-[160px] truncate sm:inline">{email}</span>
              <Link
                href="/feed"
                className="inline-flex h-11 items-center font-medium text-teal-600 hover:text-teal-700"
              >
                Back to app
              </Link>
            </div>
          </div>
          <AdminNav />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
