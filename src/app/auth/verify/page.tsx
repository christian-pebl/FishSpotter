import Link from "next/link";
import { VerifyClient } from "./VerifyClient";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12"
    >
      <div className="pebl-surface rounded-card p-6 md:p-8 text-center">
        <p className="pebl-eyebrow">Email verification</p>
        {token ? (
          <VerifyClient token={token} />
        ) : (
          <>
            <h1 className="mt-3 font-brand text-h1 text-navy-900">
              Missing verification token.
            </h1>
            <p className="mt-3 text-sm text-navy-900/72">
              Use the link from your email, or request a new verification email from{" "}
              <Link href="/account" className="text-teal-700 underline">
                your account page
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </main>
  );
}
