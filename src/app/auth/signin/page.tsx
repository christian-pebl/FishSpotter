"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/feed";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password: password || " ",
        name,
        isSignUp: isSignUp ? "true" : "false",
        redirect: false,
      });
      if (res?.error) {
        setError(isSignUp ? "Email already in use or invalid." : "Invalid email or sign in failed.");
        return;
      }
      window.location.href = callbackUrl;
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <main className="mx-auto flex w-full max-w-md flex-1 px-4 py-12">
        <div className="pebl-surface w-full rounded-[28px] p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--primary)]">PEBL community access</p>
          <h1 className="mt-3 font-brand-heading text-3xl text-[color:var(--foreground)]">
            {isSignUp ? "Create your spotting profile" : "Sign in to continue spotting"}
          </h1>
          <p className="mb-6 mt-3 text-sm leading-6 text-[color:var(--muted)]">
            Join the PEBL marine monitoring community to submit identifications, track your streak, and contribute to the shared observation record.
          </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-[color:var(--foreground)]">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
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
              Password (optional for demo)
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 text-[color:var(--foreground)]"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="pebl-button-primary w-full rounded-full py-3 font-semibold disabled:opacity-50"
          >
            {loading ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
          className="mt-4 w-full text-sm text-[color:var(--primary)] hover:text-[color:var(--foreground)]"
        >
          {isSignUp ? "Already have an account? Sign in" : "No account? Sign up"}
        </button>
        </div>
      </main>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="flex-1 max-w-sm mx-auto w-full px-4 py-12 text-slate-400">Loading…</div>}>
      <SignInForm />
    </Suspense>
  );
}
