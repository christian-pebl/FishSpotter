"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function VerifyClient({ token }: { token: string }) {
  const [status, setStatus] = useState<"verifying" | "ok" | "expired" | "error">("verifying");
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        if (r.ok) return setStatus("ok");
        if (r.status === 410) return setStatus("expired");
        setStatus("error");
      })
      .catch(() => setStatus("error"));
  }, [token]);

  if (status === "verifying") {
    return (
      <p className="mt-3 text-sm text-navy-900/72">
        Verifying your email…
      </p>
    );
  }
  if (status === "ok") {
    return (
      <>
        <h1 className="mt-3 font-brand text-h1 text-navy-900">
          Your email is verified.
        </h1>
        <p className="mt-3 text-sm text-navy-900/72">
          Welcome aboard. Time to spot some fish.
        </p>
        <Link
          href="/feed"
          className="pebl-button-primary mt-6 inline-flex items-center justify-center px-5 py-3 text-sm"
        >
          Continue spotting
        </Link>
      </>
    );
  }
  if (status === "expired") {
    return (
      <>
        <h1 className="mt-3 font-brand text-h1 text-navy-900">
          This verification link has expired.
        </h1>
        <p className="mt-3 text-sm text-navy-900/72">
          Verification links are valid for 24 hours and can only be used once. Sign in and request a fresh email from your account page.
        </p>
        <Link
          href="/account"
          className="pebl-button-primary mt-6 inline-flex items-center justify-center px-5 py-3 text-sm"
        >
          Go to account
        </Link>
        <Link
          href="/auth/signin?callbackUrl=/account"
          className="mt-3 block text-xs text-teal-700 underline hover:text-navy-900"
        >
          Sign in to request a fresh link
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="mt-3 font-brand text-h1 text-navy-900">
        Something went wrong.
      </h1>
      <p className="mt-3 text-sm text-navy-900/72">
        Couldn&apos;t verify your email right now. The link may have already
        been used. Sign in to check your status or request a fresh link.
      </p>
      <Link
        href="/auth/signin?callbackUrl=/account"
        className="pebl-button-primary mt-6 inline-flex items-center justify-center px-5 py-3 text-sm"
      >
        Back to sign in
      </Link>
    </>
  );
}
