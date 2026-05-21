"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

const overlayTextShadow = "0 1px 3px rgba(0,0,0,0.55)";

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name && name.trim()) || (email ?? "").split("@")[0] || "??";
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function AvatarMenu({ overlay = false }: { overlay?: boolean }) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [streak, setStreak] = useState<number | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!session?.user || fetchedRef.current) return;
    fetchedRef.current = true;
    fetch("/api/streak")
      .then((r) => r.json())
      .then((d: { currentStreak?: number }) => setStreak(d.currentStreak ?? 0))
      .catch(() => {});
  }, [session?.user]);

  if (status === "loading") {
    return <span className="inline-block min-h-[44px] min-w-[44px]" aria-hidden />;
  }

  if (!session?.user) {
    return (
      <Link
        href="/auth/signin"
        className={
          "pointer-events-auto inline-flex min-h-[36px] items-center rounded-full px-3 text-xs font-semibold transition-colors " +
          (overlay
            ? "text-white/90 hover:bg-white/15"
            : "text-teal-700 hover:bg-teal-50")
        }
        style={overlay ? { textShadow: overlayTextShadow } : undefined}
      >
        Sign in
      </Link>
    );
  }

  const user = session.user as { name?: string | null; email?: string | null };
  const displayName = user.name ?? "Spotter";

  return (
    <div className="relative pointer-events-auto">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setConfirming(false);
        }}
        aria-label="Open account menu"
        aria-expanded={open}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 text-[11px] font-bold text-navy-900 shadow-sm"
      >
        {initials(displayName, user.email)}
      </button>
      {open && (
        <>
          {/* click-away catcher */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            aria-label="Account menu"
            className="absolute right-0 top-full z-40 mt-2 w-64 origin-top-right rounded-2xl border border-navy-900/12 bg-white p-3 shadow-menu"
          >
            <div className="px-2 pb-2">
              <p className="truncate text-sm font-semibold text-navy-900">
                {displayName}
              </p>
              <p className="truncate text-[11px] text-navy-900/55">{user.email}</p>
              {streak !== null && (
                <p className="mt-2 text-xs text-navy-900/72">
                  Streak: <span className="font-semibold text-teal-700">{streak} day{streak === 1 ? "" : "s"}</span>
                </p>
              )}
            </div>
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="block rounded-modal px-2 py-2 text-sm text-navy-900 hover:bg-teal-50"
            >
              Account settings
            </Link>
            <Link
              href="/leaderboard"
              onClick={() => setOpen(false)}
              className="block rounded-modal px-2 py-2 text-sm text-navy-900 hover:bg-teal-50"
            >
              Leaderboard
            </Link>
            <hr className="my-1 border-navy-900/10" />
            {!confirming ? (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="w-full rounded-modal px-2 py-2 text-left text-sm text-navy-900 hover:bg-teal-50"
              >
                Sign out…
              </button>
            ) : (
              <div className="px-2 py-2">
                <p className="text-xs text-navy-900">Sign out of PEBL FishSpotter?</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/?signedOut=1" })}
                    className="pebl-button-primary px-3 py-1 text-xs"
                  >
                    Sign out
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="pebl-button-secondary px-3 py-1 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
