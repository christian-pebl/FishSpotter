"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { AGE_BAND_LABEL, parseAgeBand } from "@/lib/age";
import type { ParentalConsentPurpose } from "@/lib/parental-consent-shared";

export interface ManagedChild {
  childId: string;
  childName: string;
  ageBand: string | null;
  joinedAt: string;
  identifications: number;
  pebbles: number;
  consents: Array<{
    purpose: ParentalConsentPurpose;
    status: "pending" | "granted";
    live: boolean;
    grantedAt: string | null;
  }>;
}

type Action = "child-signin" | "export" | "delete-child" | "withdraw-prize" | "decline-request";

const PURPOSE_LABEL: Record<ParentalConsentPurpose, string> = {
  account: "Keeping their account",
  prize: "Posting the prize",
};

function dateText(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * What a parent can do for each linked child. Every action is re-checked on
 * the server against the consent the parent actually holds, so the buttons
 * shown here are a convenience, not the gate.
 */
export function ManageChildren({ token, items }: { token: string; items: ManagedChild[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function act(action: Action, child: ManagedChild, purpose?: ParentalConsentPurpose) {
    const key = `${action}:${child.childId}:${purpose ?? ""}`;
    setBusy(key);
    setMessage(null);
    try {
      const res = await fetch("/api/parent/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action, childId: child.childId, purpose }),
      });
      if (action === "export" && res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `fishspotter-${child.childName}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setMessage({ kind: "ok", text: `Downloaded ${child.childName}'s information.` });
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        signInToken?: string;
      };
      if (!res.ok || !data.ok) {
        setMessage({ kind: "error", text: data.error ?? "That didn't work. Please try again." });
        return;
      }
      if (action === "child-signin" && data.signInToken) {
        const result = await signIn("credentials", { childLink: data.signInToken, redirect: false });
        if (!result || result.error) {
          setMessage({ kind: "error", text: "Signing in didn't work. Please try again." });
          return;
        }
        router.push("/feed");
        router.refresh();
        return;
      }
      const done: Record<Action, string> = {
        "child-signin": "",
        export: "",
        "delete-child": `${child.childName}'s account and everything in it has been deleted.`,
        "withdraw-prize": `Done. We won't post the prize to ${child.childName}.`,
        "decline-request": "Done. We've deleted that request.",
      };
      setMessage({ kind: "ok", text: done[action] });
      setConfirmDelete(null);
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: "Network error. Please try again." });
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="mt-4 text-sm text-navy-900/80">
        {message?.kind === "ok" ? message.text : "Nothing is linked to this email address any more."}
      </p>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      {message && (
        <p
          className={`rounded-modal p-3 text-sm ${
            message.kind === "ok" ? "bg-surface-muted text-navy-900" : "text-incorrect-ink"
          }`}
          role={message.kind === "ok" ? "status" : "alert"}
        >
          {message.text}
        </p>
      )}
      {items.map((child) => {
        const band = parseAgeBand(child.ageBand);
        const account = child.consents.find((k) => k.purpose === "account");
        const accountGranted = account?.status === "granted";
        const isBusy = (a: Action, p?: ParentalConsentPurpose) =>
          busy === `${a}:${child.childId}:${p ?? ""}`;
        return (
          <article key={child.childId} className="rounded-card border border-navy-900/12 p-4">
            <h2 className="text-lg font-bold text-navy-900">{child.childName}</h2>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-navy-900/60">Age group</dt>
              <dd className="text-navy-900">{band ? AGE_BAND_LABEL[band] : "Not given"}</dd>
              <dt className="text-navy-900/60">Joined</dt>
              <dd className="text-navy-900">{dateText(child.joinedAt)}</dd>
              <dt className="text-navy-900/60">Identifications</dt>
              <dd className="text-navy-900">{child.identifications.toLocaleString()}</dd>
              <dt className="text-navy-900/60">Pebbles</dt>
              <dd className="text-navy-900">{child.pebbles.toLocaleString()}</dd>
            </dl>

            <ul className="mt-3 space-y-2">
              {child.consents.map((k) => (
                <li key={k.purpose} className="rounded-modal bg-surface-muted px-3 py-2 text-sm text-navy-900">
                  <span className="font-semibold">{PURPOSE_LABEL[k.purpose]}:</span>{" "}
                  {k.status === "granted"
                    ? `you agreed${k.grantedAt ? ` on ${dateText(k.grantedAt)}` : ""}.`
                    : k.live
                      ? "waiting for your answer (use the link in our email)."
                      : "the request has expired."}
                  <div className="mt-1 flex flex-wrap gap-x-4">
                    {k.status === "pending" ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => act("decline-request", child, k.purpose)}
                        className="inline-flex min-h-[44px] items-center text-teal-700 underline disabled:opacity-50"
                      >
                        {isBusy("decline-request", k.purpose) ? "Saving…" : "Say no"}
                      </button>
                    ) : null}
                    {k.purpose === "prize" && k.status === "granted" ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => act("withdraw-prize", child)}
                        className="inline-flex min-h-[44px] items-center text-teal-700 underline disabled:opacity-50"
                      >
                        {isBusy("withdraw-prize") ? "Saving…" : "Withdraw my agreement"}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>

            {accountGranted ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => act("child-signin", child)}
                  className="pebl-button-primary inline-flex min-h-[44px] items-center justify-center rounded-full px-5 text-sm font-semibold disabled:opacity-50"
                >
                  {isBusy("child-signin") ? "Signing in…" : `Sign in as ${child.childName} on this device`}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => act("export", child)}
                  className="pebl-button-secondary inline-flex min-h-[44px] items-center justify-center rounded-full px-5 text-sm font-semibold disabled:opacity-50"
                >
                  {isBusy("export") ? "Preparing…" : "Download their information"}
                </button>
                {confirmDelete === child.childId ? (
                  <div className="w-full rounded-modal border border-danger/30 bg-danger/5 p-3 text-sm">
                    <p className="text-navy-900">
                      This withdraws your agreement and deletes {child.childName}&apos;s account,
                      finds and Pebbles for good. It cannot be undone.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => act("delete-child", child)}
                        className="inline-flex min-h-[44px] items-center rounded-full bg-danger px-4 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {isBusy("delete-child") ? "Deleting…" : "Delete for good"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(null)}
                        className="inline-flex min-h-[44px] items-center rounded-full border border-navy-900/20 px-4 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => setConfirmDelete(child.childId)}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-danger/40 px-5 text-sm font-semibold text-danger hover:bg-danger/5 disabled:opacity-50"
                  >
                    Withdraw agreement and delete account
                  </button>
                )}
              </div>
            ) : null}
            <p className="mt-3 text-xs text-navy-900/60">
              Signing in on a shared device signs that device in as {child.childName} until
              someone signs out.
            </p>
          </article>
        );
      })}
    </div>
  );
}
