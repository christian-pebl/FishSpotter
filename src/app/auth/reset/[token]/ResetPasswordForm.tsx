"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (res.status === 410) {
        setError("This reset link is invalid or has expired.");
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        setError("Couldn't reset your password. Please try again.");
        setSubmitting(false);
        return;
      }
      router.replace("/auth/signin?reset=success");
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label
          htmlFor="new-password"
          className="mb-1 block text-sm font-medium text-navy-900"
        >
          New password
        </label>
        <input
          id="new-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="block w-full rounded-modal border border-navy-900/15 bg-white px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-navy-900/55">Minimum 8 characters.</p>
      </div>
      <div>
        <label
          htmlFor="confirm-password"
          className="mb-1 block text-sm font-medium text-navy-900"
        >
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="block w-full rounded-modal border border-navy-900/15 bg-white px-3 py-2 text-sm"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="pebl-button-primary w-full px-5 py-3 text-sm"
      >
        {submitting ? "Updating…" : "Set new password"}
      </button>
    </form>
  );
}
