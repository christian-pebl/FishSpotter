"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  VerificationHelp,
  verificationStatusFromResponse,
  type VerificationSendStatus,
} from "@/components/VerificationHelp";
import {
  AGE_BAND_LABEL,
  canChooseLeaderboardVisibility,
  canReceiveOptionalEmail,
  canReceiveStreakNudge,
  isUnder13,
  parseAgeBand,
} from "@/lib/age";
import {
  AGE_DECLARED_EVENT,
  PARENT_REQUESTED_EVENT,
  requestAgeCheck,
  requestParentConsent,
} from "@/lib/age-events";
import { GUEST_SAVED_EVENT, GUEST_SAVE_REQUEST_EVENT } from "@/lib/guest";
import { nicknameSuggestions } from "@/lib/nickname";
import type { ConsentState } from "@/lib/parental-consent-shared";

interface Props {
  /** A real address, or null for guests and under-13s (placeholder on file). */
  email: string | null;
  emailVerified: boolean;
  displayName: string;
  digestOptIn: boolean;
  newClipsOptIn: boolean;
  leaderboardOptIn: boolean;
  createdAt: string;
  /** User.ageBracket, null when never asked. */
  ageBand: string | null;
  /** An under-13's account consent (src/lib/parental-consent.ts). */
  parentAccount: ConsentState;
}

const DELETE_WORD = "DELETE";

/**
 * Account settings. What shows depends on the age band (src/lib/age.ts):
 * under-13s see no email settings and no public-listing switch, and pick a
 * new nickname from suggestions rather than typing one; anyone not yet asked
 * their age is asked from here too. Adults see what they always saw.
 */
export function AccountClient({
  email,
  emailVerified,
  displayName: initialDisplayName,
  digestOptIn: initialDigest,
  newClipsOptIn: initialNewClips,
  leaderboardOptIn: initialLeaderboardOptIn,
  createdAt,
  ageBand: initialAgeBand,
  parentAccount: initialParentAccount,
}: Props) {
  const router = useRouter();
  const band = parseAgeBand(initialAgeBand);
  const child = isUnder13(band);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [savedName, setSavedName] = useState(initialDisplayName);
  const [nameOptions, setNameOptions] = useState<string[]>([]);
  const [digestOptIn, setDigestOptIn] = useState(initialDigest);
  const [newClipsOptIn, setNewClipsOptIn] = useState(initialNewClips);
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(initialLeaderboardOptIn);
  const [parentAccount, setParentAccount] = useState<ConsentState>(initialParentAccount);
  const [verificationSendStatus, setVerificationSendStatus] =
    useState<VerificationSendStatus>("idle");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteStatus, setDeleteStatus] = useState<"idle" | "deleting">("idle");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [saveError, setSaveError] = useState("");

  // Answers given elsewhere on this page (the age question, a saved email, a
  // parent request) change what this page should show: ask the server again.
  useEffect(() => {
    const refresh = () => router.refresh();
    const onAsked = () => setParentAccount((s) => (s === "granted" ? s : "pending"));
    window.addEventListener(AGE_DECLARED_EVENT, refresh);
    window.addEventListener(GUEST_SAVED_EVENT, refresh);
    window.addEventListener(PARENT_REQUESTED_EVENT, onAsked);
    return () => {
      window.removeEventListener(AGE_DECLARED_EVENT, refresh);
      window.removeEventListener(GUEST_SAVED_EVENT, refresh);
      window.removeEventListener(PARENT_REQUESTED_EVENT, onAsked);
    };
  }, [router]);

  const deleteTarget = email ?? DELETE_WORD;

  const saveDisplayName = async (next: string = displayName) => {
    if (next === savedName) return;
    setSaveStatus("saving");
    setSaveError("");
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: next }),
    });
    if (res.ok) {
      const data = (await res.json()) as { displayName?: string };
      setSavedName(data.displayName ?? next);
      setDisplayName(data.displayName ?? next);
      setNameOptions([]);
      setSaveStatus("saved");
      router.refresh();
      setTimeout(() => setSaveStatus("idle"), 1600);
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setSaveError(data.error ?? "That didn't save. Please try again.");
      setSaveStatus("idle");
    }
  };

  const toggleDigest = async (next: boolean) => {
    setDigestOptIn(next);
    const res = await fetch("/api/account/digest", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ digestOptIn: next }),
    });
    if (!res.ok) setDigestOptIn(!next);
  };

  const toggleNewClips = async (next: boolean) => {
    setNewClipsOptIn(next);
    const res = await fetch("/api/account/new-clips", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newClipsOptIn: next }),
    });
    if (!res.ok) setNewClipsOptIn(!next);
  };

  const toggleLeaderboardOptIn = async (next: boolean) => {
    setLeaderboardOptIn(next);
    const res = await fetch("/api/account/leaderboard-visibility", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaderboardOptIn: next }),
    });
    if (!res.ok) setLeaderboardOptIn(!next);
  };

  const resendVerification = async () => {
    setVerificationSendStatus("sending");
    try {
      const res = await fetch("/api/auth/verify-request", { method: "POST" });
      setVerificationSendStatus(verificationStatusFromResponse(res));
    } catch {
      setVerificationSendStatus("error");
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirm.trim().toLowerCase() !== deleteTarget.toLowerCase()) return;
    setDeleteStatus("deleting");
    await fetch("/api/account", { method: "DELETE" });
    await signOut({ callbackUrl: "/?deleted=1" });
  };

  const linkButton =
    "inline-flex min-h-[44px] items-center rounded-full border border-navy-900/20 px-3 py-1 text-xs font-semibold hover:border-teal-500";

  return (
    <>
      <section className="pebl-surface rounded-card p-6">
        <p className="pebl-eyebrow">Identity</p>
        <dl className="mt-3 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-navy-900/55">Email</dt>
            <dd className="text-right text-navy-900">
              {email ? (
                <>
                  {email}{" "}
                  <span
                    className={
                      "ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow " +
                      (emailVerified ? "bg-teal-500/15 text-teal-700" : "bg-warn/15 text-warn")
                    }
                  >
                    {emailVerified ? "Verified" : "Unverified"}
                  </span>
                </>
              ) : child ? (
                parentAccount === "granted" ? (
                  "Saved by your grown-up"
                ) : (
                  <button
                    type="button"
                    onClick={() => requestParentConsent("account")}
                    className={linkButton}
                  >
                    {parentAccount === "pending" ? "Waiting for your grown-up" : "Ask a grown-up to save it"}
                  </button>
                )
              ) : band ? (
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent(GUEST_SAVE_REQUEST_EVENT))}
                  className={linkButton}
                >
                  Add my email
                </button>
              ) : (
                <span className="text-navy-900/55">None saved</span>
              )}
            </dd>
          </div>
          {email && !emailVerified && (
            <div className="rounded-modal border border-warn/30 bg-warn/5 p-3 text-xs text-navy-900">
              <p>
                Verify your email to claim prizes, enable the weekly digest and
                protect your account.
              </p>
              <button
                type="button"
                onClick={resendVerification}
                disabled={verificationSendStatus === "sending"}
                className={`mt-2 ${linkButton}`}
              >
                {verificationSendStatus === "sent" ? (
                  <span className="inline-flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M2 6.5l2.5 2.5L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Email sent
                  </span>
                ) : verificationSendStatus === "rate-limited"
                    ? "Try again later"
                    : verificationSendStatus === "sending"
                      ? "Sending…"
                      : verificationSendStatus === "unavailable"
                        ? "Could not send"
                        : verificationSendStatus === "error"
                          ? "Could not send. Retry"
                          : "Send verification email"}
              </button>
              {/* The answer to "I keep pressing resend and nothing comes":
                  where to look, and a human to email if it still does not. */}
              <VerificationHelp status={verificationSendStatus} className="mt-2" />
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <dt className="text-navy-900/55">Age group</dt>
            <dd className="text-navy-900">
              {band ? (
                AGE_BAND_LABEL[band]
              ) : (
                <button type="button" onClick={requestAgeCheck} className={linkButton}>
                  Tell us your age
                </button>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-navy-900/55">Joined</dt>
            <dd className="text-navy-900">
              {new Date(createdAt).toLocaleDateString()}
            </dd>
          </div>
        </dl>
        <div className="mt-5">
          {child ? (
            <>
              <p className="block text-xs font-semibold uppercase tracking-eyebrow text-navy-900/55">
                Nickname
              </p>
              <p className="mt-1 text-base font-semibold text-navy-900">{savedName}</p>
              {nameOptions.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setNameOptions(nicknameSuggestions(4))}
                  className={`mt-2 ${linkButton}`}
                >
                  Pick a new nickname
                </button>
              ) : (
                <div role="group" aria-label="New nickname" className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {nameOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      disabled={saveStatus === "saving"}
                      onClick={() => saveDisplayName(option)}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-navy-900/15 bg-white px-3 text-sm font-semibold text-navy-900 hover:border-teal-500 disabled:opacity-60"
                    >
                      {option}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setNameOptions(nicknameSuggestions(4))}
                    className="inline-flex min-h-[44px] items-center justify-center text-xs text-teal-700 underline sm:col-span-2"
                  >
                    Show me different ones
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
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
                  onClick={() => saveDisplayName()}
                  disabled={saveStatus === "saving" || displayName === savedName || displayName.trim().length === 0}
                  className="pebl-button-primary px-4 py-2 text-xs"
                >
                  {saveStatus === "saving" ? (
                    "Saving…"
                  ) : saveStatus === "saved" ? (
                    <span className="inline-flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M2 6.5l2.5 2.5L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Saved
                    </span>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-navy-900/55">
                {band === "13_17"
                  ? "Shown on the leaderboard only if you switch that on below. Don't use your real name."
                  : "This is what appears on the leaderboard."}
              </p>
            </>
          )}
          {saveError && (
            <p className="mt-1 text-xs text-incorrect-ink" role="alert">
              {saveError}
            </p>
          )}
        </div>
      </section>

      {!child && (
        <section className="pebl-surface rounded-card p-6">
          <p className="pebl-eyebrow">Notifications</p>
          {!band ? (
            <p className="mt-3 text-sm text-navy-900/72">
              Tell us your age to choose email updates.
            </p>
          ) : !email || !canReceiveOptionalEmail(band) ? (
            <p className="mt-3 text-sm text-navy-900/72">
              Save your account with an email to get updates about new clips.
            </p>
          ) : (
            <>
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
                    A Monday-morning summary of your week and any new clips.
                    {canReceiveStreakNudge(band)
                      ? " Streak nudges sit under this same opt-in."
                      : ""}
                  </span>
                </span>
              </label>
              <label className="mt-4 flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={newClipsOptIn}
                  onChange={(e) => toggleNewClips(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-navy-900/20"
                />
                <span>
                  <span className="block font-medium text-navy-900">
                    Tell me when new clips are added
                  </span>
                  <span className="block text-xs text-navy-900/55">
                    A short email the day new footage lands, so you get first go at
                    identifying it. Nothing is sent when there is nothing new.
                  </span>
                </span>
              </label>
              {!emailVerified && (
                <p className="mt-3 rounded-modal border border-warn/30 bg-warn/5 p-3 text-xs text-navy-900">
                  Verify your email above to start receiving these. We only send to
                  confirmed addresses.
                </p>
              )}
            </>
          )}
        </section>
      )}

      <section className="pebl-surface rounded-card p-6">
        <p className="pebl-eyebrow">Privacy</p>
        {child ? (
          <p className="mt-3 text-sm text-navy-900/72">
            Your score is private: only you can see your rank. Under-13s are never shown on public
            leaderboards or profiles.
          </p>
        ) : (
          <label className="mt-3 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={leaderboardOptIn && canChooseLeaderboardVisibility(band)}
              disabled={!canChooseLeaderboardVisibility(band)}
              onChange={(e) => toggleLeaderboardOptIn(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-navy-900/20"
            />
            <span>
              <span className="block font-medium text-navy-900">
                Show me on the public leaderboard
              </span>
              <span className="block text-xs text-navy-900/55">
                {band
                  ? "When off, your score is private, so only you can see your own rank. Accounts declared as under 18 start with this off."
                  : "Tell us your age first. Until then your score is private."}
              </span>
            </span>
          </label>
        )}
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
            className="mt-3 min-h-[44px] rounded-full border border-danger/40 px-4 py-2 text-xs font-semibold text-danger hover:bg-danger/5"
          >
            Delete account
          </button>
        ) : (
          <div className="mt-3 rounded-modal border border-danger/30 bg-danger/5 p-3 text-xs">
            <label htmlFor="delete-confirm" className="block text-navy-900">
              Type {email ? "your email" : "the word"} to confirm: <code>{deleteTarget}</code>
            </label>
            <input
              id="delete-confirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={email ? "your email" : DELETE_WORD}
              autoComplete="off"
              className="mt-2 block w-full rounded-modal border border-navy-900/15 bg-white px-3 py-2 text-xs"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={deleteAccount}
                disabled={
                  deleteStatus === "deleting" ||
                  deleteConfirm.trim().toLowerCase() !== deleteTarget.toLowerCase()
                }
                className="min-h-[44px] rounded-full bg-danger px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
              >
                {deleteStatus === "deleting" ? "Deleting…" : "Confirm delete"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setDeleteConfirm("");
                }}
                className="min-h-[44px] rounded-full border border-navy-900/20 px-3 py-1 text-xs"
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
