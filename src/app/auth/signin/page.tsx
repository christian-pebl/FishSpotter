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
      <main className="flex-1 max-w-sm mx-auto w-full px-4 py-12">
        <h1 className="text-2xl font-bold mb-6">{isSignUp ? "Create account" : "Sign in"}</h1>
        <p className="text-slate-400 mb-6 text-sm">
          Sign in to submit answers and appear on the leaderboard.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-white"
            />
          </div>
          {isSignUp && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">
                Display name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="How you'll appear on the leaderboard"
                className="w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-white placeholder-slate-500"
              />
            </div>
          )}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
              Password (optional for demo)
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-white"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-500 text-slate-900 font-semibold py-3 rounded-lg hover:bg-cyan-400 disabled:opacity-50"
          >
            {loading ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
          className="mt-4 w-full text-slate-400 hover:text-white text-sm"
        >
          {isSignUp ? "Already have an account? Sign in" : "No account? Sign up"}
        </button>
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
