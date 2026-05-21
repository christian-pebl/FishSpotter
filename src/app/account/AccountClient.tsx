"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  email: string;
  emailVerified: boolean;
  displayName: string;
  digestOptIn: boolean;
  createdAt: string;
}

export function AccountClient({
  email,
  emailVerified,
  displayName: initialDisplayName,
  digestOptIn: initialDigest,
  createdAt,
}: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [savedName, setSavedName] = useState(initialDisplayName);
  const [digestOptIn, setDigestOptIn] = useState(initialDigest);
  const [verificationSendStatus, setVerificationSendStatus] = useState<"idle" | "sending" | "sent" | "rate-limited">("idle");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [emailConfirm, setEmailConfirm] = useState("");
  const [deleteStatus, setDeleteStatus] = useState<"idle" | "deleting">("idle");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const saveDisplayName = async () => {
    if (displayName === savedName) return;
    setSaveStatus("saving");
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    if (res.ok) {
      const data = (await res.json()) as { displayName?: string };
      setSavedName(data.displayName ?? displayName);
      setSaveStatus("saved");
      router.refresh();
      setTimeout(() => setSaveStatus("idle"), 1600);
    } else {
      setSaveStatus("idle");
    }
  };

  const toggleDigest = async (next: boolean) => {
    setDigestOptIn(next);
    await fetch("/api/account/digest", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ digestOptIn: next }),
    });
  };

  const resendVerification = async () => {
    setVerificationSendStatus("sending");
    const res = await fetch("/api/auth/verify-request", { method: "POST" });
    if (res.status === 429) {
      setVerificationSendStatus("rate-limited");
      return;
    }
    setVerificationSendStatus(res.ok ? "sent" : "idle");
  };

  const deleteAccount = async () => {
    if (emailConfirm.trim().toLowerCase() !== email.toLowerCase()) return;
    setDeleteStatus("deleting");
    await fetch("/api/account", { method: "DELETE" });
    await signOut({ callbackUrl: "/?deleted=1" });
  };

  return (
    <>
      <section className="pebl-surface rounded-card p-6">
        <p className="pebl-eyebrow">Identity</p>
        <dl className="mt-3 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-navy-900/55">Email</dt>
            <dd className="text-navy-900">
              {email}{" "}
              <span
                className={
                  "ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow " +
                  (emailVerified
                    ? "bg-teal-500/15 text-teal-700"
                    : "bg-warn/15 text-warn")
                }
              >
                {emailVerified ? "Verified" : "Unverified"}
              </span>
            </dd>
          </div>
          {!emailVerified && (
            <div className="rounded-modal border border-warn/30 bg-warn/5 p-3 text-xs text-navy-900">
              <p>
                Verify your email to enable the weekly digest and protect your
                account.
              </p>
              <button
                type="button"
                onClick={resendVerification}
                disabled={verificationSendStatus === "sending"}
                className="mt-2 rounded-full border border-navy-900/20 px-3 py-1 text-xs font-semibold hover:border-teal-500"
              >
                {verificationSendStatus === "sent"
                  ? "Email sent ✓"
                  : verificationSendStatus === "rate-limited"
                    ? "Try again later"
                    : verificationSendStatus === "sending"
                      ? "Sending…"
                      : "Send verification email"}
              </button>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <dt className="text-navy-900/55">Joined</dt>
            <dd className="text-navy-900">
              {new Date(createdAt).toLocaleDateString()}
            </dd>
          </div>
        </dl>
        <div className="mt-5">
          <label
            htmlFor="display-name"
            className="block text-xs font-semibold uppercase tracking-eyebrow text-navy-900/55"
          >
            Display name
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id="display-name"
              value={displayName}
              maxLength={32}
              onChange={(e) => setDisplayName(e.target.value)}
              className="block flex-1 rounded-modal border border-navy-900/15 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={saveDisplayName}
              disabled={saveStatus === "saving" || displayName === savedName || displayName.trim().length === 0}
              className="pebl-button-primary px-4 py-2 text-xs"
            >
              {saveStatus === "saving"
                ? "Saving…"
                : saveStatus === "saved"
                  ? "Saved ✓"
                  : "Save"}
            </button>
          </div>
          <p className="mt-1 text-xs text-navy-900/55">
            This is what appears on the leaderboard.
          </p>
        </div>
      </section>

      <section className="pebl-surface rounded-card p-6">
        <p className="pebl-eyebrow">Notifications</p>
        <label className="mt-3 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={digestOptIn}
            onChange={(e) => toggleDigest(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-navy-900/20"
          />
          <span>
            <span className="block font-medium text-navy-900">
              Weekly digest
            </span>
            <span className="block text-xs text-navy-900/55">
              A Monday-morning summary of your week and any new clips. Streak
              nudges sit under this same opt-in.
            </span>
          </span>
        </label>
      </section>

      <section className="pebl-surface rounded-card p-6">
        <p className="pebl-eyebrow text-danger">Danger zone</p>
        <h2 className="mt-2 text-base font-semibold text-navy-900">
          Delete your account
        </h2>
        <p className="mt-1 text-sm text-navy-900/72">
          This removes your account and every quiz answer associated with it.
          It is immediate and cannot be undone.
        </p>
        {!deleteDialogOpen ? (
          <button
            type="button"
            onClick={() => setDeleteDialogOpen(true)}
            className="mt-3 rounded-full border border-danger/40 px-4 py-2 text-xs font-semibold text-danger hover:bg-danger/5"
          >
            Delete account
          </button>
        ) : (
          <div className="mt-3 rounded-modal border border-danger/30 bg-danger/5 p-3 text-xs">
            <p className="text-navy-900">
              Type your email to confirm: <code>{email}</code>
            </p>
            <input
              value={emailConfirm}
              onChange={(e) => setEmailConfirm(e.target.value)}
              placeholder="your email"
              className="mt-2 block w-full rounded-modal border border-navy-900/15 bg-white px-3 py-2 text-xs"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={deleteAccount}
                disabled={
                  deleteStatus === "deleting" ||
                  emailConfirm.trim().toLowerCase() !== email.toLowerCase()
                }
                className="rounded-full bg-danger px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
              >
                {deleteStatus === "deleting" ? "Deleting…" : "Confirm delete"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setEmailConfirm("");
                }}
                className="rounded-full border border-navy-900/20 px-3 py-1 text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="pebl-surface rounded-card p-6 text-sm">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="pebl-button-secondary px-4 py-2 text-sm"
        >
          Sign out
        </button>
      </section>
    </>
  );
}
