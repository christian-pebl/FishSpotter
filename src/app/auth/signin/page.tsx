"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

// Accept only same-origin relative paths: must start with "/" and not "//"
// (protocol-relative URLs like //evil.com would otherwise pass through to
// the browser as cross-origin redirects). Anything else falls back to /feed.
function safeCallback(raw: string): string {
  return /^\/(?!\/)/.test(raw) ? raw : "/feed";
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallback(searchParams.get("callbackUrl") ?? "/feed");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  // Default to sign-up when arriving from the landing CTA
  // (`/auth/signin?isSignUp=1`). Otherwise default to sign-in.
  const [isSignUp, setIsSignUp] = useState(searchParams.get("isSignUp") === "1");

  // P-19: surface a contextual line when the user was redirected here
  // rather than navigating intentionally (e.g. tried to access /feed
  // while signed out). callbackUrl != /feed means they were mid-journey.
  const arrivedFromProtected =
    callbackUrl !== "/feed" && searchParams.get("isSignUp") !== "1";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      const res = await signIn("credentials", {
        email,
        password,
        name,
        isSignUp: isSignUp ? "true" : "false",
        redirect: false,
      });
      if (res?.error) {
        // P-12: actionable error copy — tells the user what to do next,
        // not just that something went wrong.
        setError(
          isSignUp
            ? "That email is already registered. Try signing in instead, or use a different address."
            : "Wrong email or password. Check your details and try again.",
        );
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-md flex-1 px-4 py-12">
        <div className="pebl-surface w-full rounded-hero p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-[color:var(--primary)]">PEBL community access</p>
          <h1 className="mt-3 font-brand-heading text-3xl text-[color:var(--foreground)]">
            {isSignUp ? "Create your spotting profile" : "Sign in to continue spotting"}
          </h1>
          {arrivedFromProtected ? (
            <p className="mb-6 mt-3 text-sm leading-6 text-[color:var(--muted)]">
              Sign in to continue — your progress is waiting.
            </p>
          ) : (
            <p className="mb-6 mt-3 text-sm leading-6 text-[color:var(--muted)]">
              Join the PEBL marine monitoring community to submit identifications, track your streak, and contribute to the shared observation record.
            </p>
          )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-[color:var(--foreground)]">
              Email <span aria-hidden className="text-red-600">*</span>
            </label>
            <input
              id="email"
              type="email"
              required
              aria-required="true"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 text-[color:var(--foreground)]"
            />
          </div>
          {isSignUp && (
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-[color:var(--foreground)]">
                Display name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="How you will appear in the community"
                className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 text-[color:var(--foreground)] placeholder:text-[color:var(--muted)]"
              />
            </div>
          )}
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-[color:var(--foreground)]">
              Password <span aria-hidden className="text-red-600">*</span>
              <span className="ml-2 text-xs font-normal text-[color:var(--muted)]">(at least 8 characters)</span>
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              aria-required="true"
              aria-describedby={error ? "auth-error" : undefined}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 text-[color:var(--foreground)]"
            />
          </div>
          {isSignUp && (
            <ul className="text-xs text-[color:var(--muted)] -mt-2 space-y-0.5" aria-live="polite">
              <li className={password.length >= 8 ? "text-teal-700" : ""}>
                {password.length >= 8 ? "✓" : "•"} at least 8 characters
              </li>
              <li className={/[a-z]/.test(password) && /[A-Z]/.test(password) ? "text-teal-700" : ""}>
                {/[a-z]/.test(password) && /[A-Z]/.test(password) ? "✓" : "•"} mixed case (recommended)
              </li>
              <li className={/[0-9]/.test(password) ? "text-teal-700" : ""}>
                {/[0-9]/.test(password) ? "✓" : "•"} includes a number (recommended)
              </li>
            </ul>
          )}
          {isSignUp && (
            <label className="flex items-start gap-2 text-xs text-[color:var(--muted)]">
              <input
                type="checkbox"
                required
                aria-required="true"
                className="mt-0.5 h-4 w-4 rounded border-navy-900/20"
              />
              <span>
                I agree to the{" "}
                <Link href="/terms" className="text-teal-700 underline">Terms</Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-teal-700 underline">Privacy Policy</Link>.
              </span>
            </label>
          )}
          {error && (
            <p id="auth-error" role="alert" className="text-sm text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="pebl-button-primary inline-flex w-full items-center justify-center min-h-[44px] rounded-full py-3 font-semibold disabled:cursor-not-allowed disabled:bg-[color:var(--accent)]/70 disabled:text-[color:var(--foreground)]/70"
          >
            {loading ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
            className="text-[color:var(--primary)] hover:text-[color:var(--foreground)]"
          >
            {isSignUp ? "Already have an account? Sign in" : "No account? Sign up"}
          </button>
          {!isSignUp && (
            <Link
              href="/auth/forgot"
              className="text-[color:var(--muted)] underline hover:text-[color:var(--foreground)]"
            >
              Forgot password?
            </Link>
          )}
        </div>
        </div>
      </main>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div
          aria-busy="true"
          aria-label="Loading sign in"
          className="pebl-surface rounded-hero mx-auto w-full max-w-sm animate-pulse p-6"
        >
          <div className="h-3 w-24 rounded-full bg-navy-900/12" />
          <div className="mt-3 h-7 w-2/3 max-w-md rounded-full bg-navy-900/12" />
          <div className="mt-6 space-y-3">
            <div className="h-10 w-full rounded-modal bg-navy-900/12" />
            <div className="h-10 w-full rounded-modal bg-navy-900/12" />
            <div className="h-11 w-full rounded-full bg-navy-900/12" />
          </div>
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
