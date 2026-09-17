import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MarineBackdrop } from "@/components/MarineBackdrop";
import { ManageChildren, type ManagedChild } from "@/components/parent/ManageChildren";
import { listChildrenForParent, resolveManageToken } from "@/lib/parental-consent";

export const dynamic = "force-dynamic";

// The token in the URL is a credential: keep the page out of search results
// and out of the Referer header of any link followed from it.
export const metadata: Metadata = {
  title: "Manage your child's account",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * The parent page behind an emailed link. Lists every child linked to the
 * parent's address, what we hold on each, and the actions the parent's
 * consent allows (checked again server-side by POST /api/parent/manage).
 */
export default async function ParentManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ agreed?: string }>;
}) {
  const [{ token }, { agreed }] = await Promise.all([params, searchParams]);
  const now = new Date();
  const parentEmail = await resolveManageToken(prisma, token, now);
  const children = parentEmail ? await listChildrenForParent(prisma, parentEmail, now) : [];

  const view: ManagedChild[] = children.map((c) => ({
    childId: c.childId,
    childName: c.childName,
    ageBand: c.ageBand,
    joinedAt: c.joinedAt.toISOString(),
    identifications: c.identifications,
    pebbles: c.pebbles,
    consents: c.consents.map((k) => ({
      purpose: k.purpose,
      status: k.status,
      live: k.live,
      grantedAt: k.grantedAt ? k.grantedAt.toISOString() : null,
    })),
  }));

  return (
    <MarineBackdrop>
      <div className="flex-1 overflow-y-auto">
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
          <section className="pebl-surface rounded-card p-6 md:p-8">
            <p className="pebl-eyebrow text-xs">For parents and carers</p>
            {!parentEmail ? (
              <>
                <h1 className="mt-2 font-brand-heading text-h2 text-navy-900">
                  This link has expired
                </h1>
                <p className="mt-3 text-sm leading-7 text-navy-900">
                  For your child&apos;s safety these links only last a short while. Ask for a new one
                  on the{" "}
                  <Link href="/parent" className="text-teal-700 underline">
                    parent page
                  </Link>
                  .
                </p>
              </>
            ) : (
              <>
                <h1 className="mt-2 font-brand-heading text-h2 text-navy-900">
                  Your child&apos;s FishSpotter
                </h1>
                {agreed ? (
                  <p className="mt-3 rounded-modal bg-surface-muted p-3 text-sm text-navy-900" role="status">
                    Thank you, your agreement is saved. We&apos;ll email you tomorrow to confirm it,
                    with a link back here.
                  </p>
                ) : null}
                <p className="mt-3 text-sm leading-7 text-navy-900">
                  Everything linked to your email address is below. This page works for a limited
                  time; after that, ask for a new link on the{" "}
                  <Link href="/parent" className="text-teal-700 underline">
                    parent page
                  </Link>
                  .
                </p>
                <ManageChildren token={token} items={view} />
              </>
            )}
          </section>
        </main>
      </div>
    </MarineBackdrop>
  );
}
