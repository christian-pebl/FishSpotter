import Link from "next/link";
import { hashToken } from "@/lib/auth/tokens";
import { prisma } from "@/lib/prisma";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const hashed = hashToken(token);
  const row = await prisma.passwordResetToken.findUnique({
    where: { token: hashed },
    select: { id: true, expiresAt: true, consumedAt: true },
  });

  const expired =
    !row || !!row.consumedAt || row.expiresAt.getTime() < Date.now();

  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12"
    >
      <div className="pebl-surface rounded-card p-6 md:p-8">
        <p className="pebl-eyebrow">Set a new password</p>
        {expired ? (
          <>
            <h1 className="mt-3 font-brand text-h1 text-navy-900">
              This link has expired.
            </h1>
            <p className="mt-3 text-sm text-navy-900/72">
              Reset links are valid for 1 hour and can only be used once.
            </p>
            <Link
              href="/auth/forgot"
              className="pebl-button-primary mt-6 inline-flex items-center justify-center px-5 py-3 text-sm"
            >
              Request a new link
            </Link>
          </>
        ) : (
          <ResetPasswordForm token={token} />
        )}
      </div>
    </main>
  );
}
