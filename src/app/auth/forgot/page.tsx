"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        setStatus("error");
        setError("Too many attempts. Try again in 15 minutes.");
        return;
      }
      if (!res.ok) {
        setStatus("error");
        setError("Something went wrong. Please try again.");
        return;
      }
      setStatus("done");
    } catch {
      setStatus("error");
      setError("Network error. Please try again.");
    }
  };

  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12"
    >
      <div className="pebl-surface rounded-card p-6 md:p-8">
        <p className="pebl-eyebrow">Reset password</p>
        {/* P-14: match sign-in page font + contrast tokens */}
        <h1 className="mt-3 font-brand-heading text-3xl text-[color:var(--foreground)]">
          Forgot your password?
        </h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
          Enter your account email and we&apos;ll send you a link to set a new one.
        </p>

        {status === "done" ? (
          <div className="mt-6 rounded-modal border border-teal-500/30 bg-teal-50 p-4 text-sm text-navy-900">
            <p>
              If an account exists for that address, a reset link is on its way. The link expires in 1 hour and can only be used once.
            </p>
            <Link href="/auth/signin" className="mt-3 inline-block text-teal-700 underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-navy-900">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 text-[color:var(--foreground)]"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={status === "submitting"}
              className="pebl-button-primary inline-flex w-full min-h-[44px] items-center justify-center rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-60"
            >
              {status === "submitting" ? "Sending…" : "Send reset link"}
            </button>
            <Link href="/auth/signin" className="block text-center text-xs text-[color:var(--muted)] underline hover:text-[color:var(--foreground)]">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
