"use client";

import { useState } from "react";

/** Ask for a manage link (POST /api/parent/manage-link). */
export function ParentLinkForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setMessage({ kind: "error", text: "Enter your email address." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/parent/manage-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      setMessage(
        res.ok
          ? { kind: "ok", text: data.message ?? "Check your inbox." }
          : { kind: "error", text: data.error ?? "That didn't work. Please try again." },
      );
    } catch {
      setMessage({ kind: "error", text: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 max-w-md">
      <label htmlFor="parent-link-email" className="block text-sm font-medium text-navy-900">
        Your email address
      </label>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row">
        <input
          id="parent-link-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="w-full flex-1 rounded-modal border border-navy-900/15 bg-white px-3 py-2.5 text-base text-navy-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
        />
        <button
          type="submit"
          disabled={busy}
          className="pebl-button-primary inline-flex min-h-[44px] items-center justify-center rounded-full px-5 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Sending…" : "Email me a link"}
        </button>
      </div>
      {message && (
        <p
          className={`mt-2 text-sm ${message.kind === "ok" ? "text-teal-700" : "text-incorrect-ink"}`}
          role={message.kind === "ok" ? "status" : "alert"}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
