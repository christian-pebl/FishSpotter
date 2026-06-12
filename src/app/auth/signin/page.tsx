"use client";

import { getProviders, signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

// Accept only same-origin relative paths: must start with "/" and not "//"
// (protocol-relative URLs like //evil.com would otherwise pass through to
// the browser as cross-origin redirects). Anything else falls back to /feed.
function safeCallback(raw: string): string {
  return /^\/(?!\/)/.test(raw) ? raw : "/feed";
}

// Password-requirement marker: SVG tick when met, a small dot when not.
// Replaces the old Unicode glyphs; carries an sr-only met/not-met status so
// the cue is not colour-only.
function PwReqMark({ met }: { met: boolean }) {
  return (
    <>
      {met ? (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0">
          <path d="M2 6.5l2.5 2.5L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <span aria-hidden="true" className="inline-block h-1 w-1 shrink-0 rounded-full bg-current opacity-50" />
      )}
      <span className="sr-only">{met ? "Met: " : "Not met: "}</span>
    </>
  );
}

// Brand glyphs for the OAuth buttons. Recognisable logos, not decorative UI
// icons, so the multi-colour Google G is intentional (and the colour carries
// no information — the label says which provider).
function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.92v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.92a9 9 0 0 0 0 8.1l3.05-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.59A9 9 0 0 0 .92 4.95L3.97 7.3C4.68 5.17 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="shrink-0">
      <path d="M11.18 8.46c-.02-1.7 1.39-2.52 1.45-2.56-.79-1.16-2.02-1.32-2.46-1.34-1.05-.11-2.04.62-2.57.62-.53 0-1.34-.6-2.2-.59-1.13.02-2.18.66-2.76 1.67-1.18 2.05-.3 5.08.85 6.74.56.81 1.23 1.72 2.11 1.69.85-.03 1.17-.55 2.2-.55 1.02 0 1.31.55 2.2.53.91-.02 1.49-.83 2.05-1.64.65-.94.92-1.85.93-1.9-.02-.01-1.78-.69-1.8-2.72zM9.5 3.6c.47-.57.79-1.36.7-2.15-.68.03-1.5.45-1.98 1.02-.43.5-.81 1.3-.71 2.07.76.06 1.53-.39 2-.94z" />
    </svg>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallback(searchParams.get("callbackUrl") ?? "/feed");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  // ICO Children's Code: self-declared age band at signup. "" = not chosen.
  const [ageBracket, setAgeBracket] = useState("");
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
  // One-tap providers, surfaced only when configured server-side (Google/Apple
  // are env-gated in lib/auth.ts). If none are set, the block renders nothing
  // and the email/password form is the whole page — no empty "or" divider.
  const [oauthProviders, setOauthProviders] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    let active = true;
    getProviders()
      .then((p) => {
        if (!p || !active) return;
        const wanted = ["google", "apple"];
        setOauthProviders(
          Object.values(p)
            .filter((prov) => wanted.includes(prov.id))
            .map((prov) => ({ id: prov.id, name: prov.name })),
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (isSignUp) {
        if (!ageBracket) {
          setError("Please tell us your age band.");
          return;
        }
        if (ageBracket === "under_13") {
          setError(
            "You need to be at least 13 to create a FishSpotter account.",
          );
          return;
        }
      }
      const res = await signIn("credentials", {
        email,
        password,
        name,
        isSignUp: isSignUp ? "true" : "false",
        ageBracket,
        redirect: false,
      });
      if (res?.error) {
        // P-12: actionable error copy, tells the user what to do next,
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
        <div className="pebl-surface w-full rounded-card p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-teal-600">PEBL community access</p>
          <h1 className="mt-3 font-brand-heading text-h1 text-navy-900">
            {isSignUp ? "Create your spotting profile" : "Sign in to continue spotting"}
          </h1>
          {arrivedFromProtected ? (
            <p className="mb-6 mt-3 text-sm leading-7 text-navy-900/72">
              Sign in to continue. Your progress is waiting.
            </p>
          ) : (
            <p className="mb-6 mt-3 text-sm leading-7 text-navy-900/72">
              Join the PEBL marine monitoring community to submit identifications, track your streak, and contribute to the shared observation record.
            </p>
          )}
        {oauthProviders.length > 0 && (
          <div className="mb-6 space-y-2">
            {oauthProviders.map((prov) => (
              <button
                key={prov.id}
                type="button"
                onClick={() => signIn(prov.id, { callbackUrl })}
                className="inline-flex w-full items-center justify-center gap-2.5 min-h-[44px] rounded-full border border-navy-900/15 bg-white px-4 py-3 text-sm font-semibold text-navy-900 transition-colors hover:bg-[color:var(--surface-muted)]"
              >
                {prov.id === "google" ? <GoogleGlyph /> : <AppleGlyph />}
                Continue with {prov.name}
              </button>
            ))}
            <div className="flex items-center gap-3 pt-2 text-xs text-navy-900/45">
              <span className="h-px flex-1 bg-navy-900/10" />
              or use email
              <span className="h-px flex-1 bg-navy-900/10" />
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-navy-900">
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
              className="w-full rounded-modal border border-navy-900/12 bg-[color:var(--surface-muted)] px-4 py-3 text-navy-900"
            />
          </div>
          {isSignUp && (
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-navy-900">
                Display name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="How you will appear in the community"
                className="w-full rounded-modal border border-navy-900/12 bg-[color:var(--surface-muted)] px-4 py-3 text-navy-900 placeholder:text-navy-900/72"
              />
            </div>
          )}
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-navy-900">
              Password <span aria-hidden className="text-red-600">*</span>
              <span className="ml-2 text-xs font-normal text-navy-900/72">(at least 8 characters)</span>
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
              className="w-full rounded-modal border border-navy-900/12 bg-[color:var(--surface-muted)] px-4 py-3 text-navy-900"
            />
          </div>
          {isSignUp && (
            <ul className="text-xs text-navy-900/72 -mt-2 space-y-0.5" aria-live="polite">
              <li className={`flex items-center gap-1.5 ${password.length >= 8 ? "text-teal-700" : ""}`}>
                <PwReqMark met={password.length >= 8} /> at least 8 characters
              </li>
              <li className={`flex items-center gap-1.5 ${/[a-z]/.test(password) && /[A-Z]/.test(password) ? "text-teal-700" : ""}`}>
                <PwReqMark met={/[a-z]/.test(password) && /[A-Z]/.test(password)} /> mixed case (recommended)
              </li>
              <li className={`flex items-center gap-1.5 ${/[0-9]/.test(password) ? "text-teal-700" : ""}`}>
                <PwReqMark met={/[0-9]/.test(password)} /> includes a number (recommended)
              </li>
            </ul>
          )}
          {isSignUp && (
            <div>
              <label htmlFor="ageBracket" className="mb-1 block text-sm font-medium text-navy-900">
                Your age <span aria-hidden className="text-red-600">*</span>
              </label>
              <select
                id="ageBracket"
                required
                aria-required="true"
                value={ageBracket}
                onChange={(e) => setAgeBracket(e.target.value)}
                className="w-full rounded-modal border border-navy-900/12 bg-[color:var(--surface-muted)] px-4 py-3 text-navy-900"
              >
                <option value="" disabled>
                  Select your age
                </option>
                <option value="under_13">Under 13</option>
                <option value="13_17">13 to 17</option>
                <option value="18_plus">18 or over</option>
              </select>
              <p className="mt-1 text-xs text-navy-900/72">
                If you are under 18, a parent or guardian must agree to the Terms on your behalf. Under-18 accounts are kept off the public leaderboard by default, you can change this later in your account settings.
              </p>
            </div>
          )}
          {isSignUp && (
            <label className="flex items-start gap-2 text-xs text-navy-900/72">
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
            className="pebl-button-primary inline-flex w-full items-center justify-center min-h-[44px] rounded-full py-3 font-semibold disabled:cursor-not-allowed disabled:bg-[color:var(--accent)]/70 disabled:text-navy-900/70"
          >
            {loading ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
            className="text-teal-600 hover:text-navy-900"
          >
            {isSignUp ? "Already have an account? Sign in" : "No account? Sign up"}
          </button>
          {!isSignUp && (
            <Link
              href="/auth/forgot"
              className="text-navy-900/72 underline hover:text-navy-900"
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
          className="pebl-surface rounded-card mx-auto w-full max-w-md animate-pulse motion-reduce:animate-none p-6"
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
