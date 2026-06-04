import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AccountClient } from "./AccountClient";
import { MarineBackdrop } from "@/components/MarineBackdrop";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/account");
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      displayName: true,
      name: true,
      emailVerified: true,
      digestOptIn: true,
      leaderboardOptIn: true,
      createdAt: true,
    },
  });
  if (!user) {
    redirect("/auth/signin?callbackUrl=/account");
  }

  return (
    <MarineBackdrop>
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-10"
    >
      <section className="pebl-surface rounded-card p-6 md:p-8">
        <p className="pebl-eyebrow">Your account</p>
        <h1 className="mt-3 font-brand text-h1 text-navy-900">
          Account settings
        </h1>
        <p className="mt-2 text-sm text-navy-900/72">
          Manage your profile, email preferences, and account.
        </p>
      </section>

      <AccountClient
        email={user.email}
        emailVerified={!!user.emailVerified}
        displayName={user.displayName ?? user.name ?? ""}
        digestOptIn={user.digestOptIn}
        leaderboardOptIn={user.leaderboardOptIn}
        createdAt={user.createdAt.toISOString()}
      />

      <section className="pebl-surface rounded-card p-6">
        <p className="pebl-eyebrow">Your data</p>
        <p className="mt-2 text-sm text-navy-900/72">
          Download a JSON file with everything we hold on you — account plus every answer. UK GDPR Art. 20.
        </p>
        <a
          href="/api/account/export"
          className="pebl-button-secondary mt-3 inline-flex items-center justify-center px-4 py-2 text-sm"
        >
          Export my data
        </a>
      </section>

      <section className="pebl-surface rounded-card p-6">
        <p className="pebl-eyebrow">Legal</p>
        <ul className="mt-3 space-y-1 text-sm">
          <li>
            <Link href="/privacy" className="text-teal-700 underline">
              Privacy policy
            </Link>
          </li>
          <li>
            <Link href="/terms" className="text-teal-700 underline">
              Terms of service
            </Link>
          </li>
          <li>
            <Link href="/accessibility" className="text-teal-700 underline">
              Accessibility statement
            </Link>
          </li>
        </ul>
      </section>
    </main>
    </MarineBackdrop>
  );
}
