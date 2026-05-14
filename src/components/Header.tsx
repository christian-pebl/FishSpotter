"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PwaInstallButton } from "@/components/PwaInstallButton";
import { SettingsMenu } from "@/components/SettingsMenu";
import { isSoundsEnabled, setSoundsEnabled } from "@/lib/sounds";

export function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const onFeed = pathname?.startsWith("/feed") ?? false;
  const [streak, setStreak] = useState<number | null>(null);
  const [soundsOn, setSoundsOn] = useState(true);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setSoundsOn(isSoundsEnabled());
    const onSoundsChanged = () => setSoundsOn(isSoundsEnabled());
    window.addEventListener("fishspotter:soundsChanged", onSoundsChanged);
    return () => window.removeEventListener("fishspotter:soundsChanged", onSoundsChanged);
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setStreak(null);
      return;
    }
    fetch("/api/streak")
      .then((res) => res.json())
      .then((data) => setStreak(data.currentStreak ?? 0))
      .catch(() => setStreak(0));
  }, [session?.user]);

  useEffect(() => {
    const onStreakUpdate = () => {
      if (session?.user) {
        fetch("/api/streak")
          .then((res) => res.json())
          .then((data) => setStreak(data.currentStreak ?? 0))
          .catch(() => {});
      }
    };
    window.addEventListener("fishspotter:streak", onStreakUpdate);
    return () => window.removeEventListener("fishspotter:streak", onStreakUpdate);
  }, [session?.user]);

  const navItemClass =
    "pebl-button-secondary inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full px-3 py-2 text-sm font-medium";
  const primaryItemClass =
    "pebl-button-primary inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full px-4 py-2 text-sm font-semibold";

  return (
    <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]/88 px-4 py-2 backdrop-blur">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
        <Link
          href="/"
          className="shrink-0 inline-flex flex-col gap-0.5 min-h-[44px] justify-center"
          aria-label="PEBL FishSpotter home"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/PEBL Logo-1.svg"
            alt=""
            aria-hidden
            className="h-7 w-auto md:h-10"
          />
          <span className="hidden md:block text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
            FishSpotter
          </span>
        </Link>
        <nav className="flex items-center gap-1.5 md:gap-2" aria-label="Primary">
          <Link href="/feed" className={`${navItemClass} hidden md:inline-flex`}>
            Live feed
          </Link>
          <Link href="/feed/browse" className={`${navItemClass} hidden md:inline-flex`}>
            Archive
          </Link>
          <Link href="/leaderboard" className={`${navItemClass} hidden md:inline-flex`}>
            Community
          </Link>
          <PwaInstallButton />
          <button
            type="button"
            onClick={() => {
              setSoundsEnabled(!soundsOn);
              setSoundsOn(!soundsOn);
            }}
            className={navItemClass}
            aria-label={soundsOn ? "Sound on — tap to mute" : "Sound off — tap to unmute"}
            aria-pressed={soundsOn}
          >
            <span className="hidden md:inline">{soundsOn ? "Sound on" : "Sound off"}</span>
            <span className="md:hidden" aria-hidden>{soundsOn ? "🔊" : "🔇"}</span>
          </button>
          {session && streak !== null && streak > 0 && (
            <motion.span
              className="inline-flex items-center gap-1 min-h-[44px] rounded-full border border-[color:var(--primary)]/20 bg-[color:var(--surface-muted)] px-3 py-1.5 text-sm font-medium text-[color:var(--primary)]"
              role="status"
              aria-live="polite"
              aria-label={`Current streak: ${streak} day${streak === 1 ? "" : "s"}`}
              animate={reduceMotion ? undefined : { scale: [1, 1.12, 1] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            >
              <span aria-hidden>🔥</span>
              <span className="hidden sm:inline">{streak} day streak</span>
              <span className="sm:hidden">{streak}</span>
            </motion.span>
          )}
          {status === "loading" ? (
            <span className="text-sm text-[color:var(--muted)]">…</span>
          ) : session ? (
            <button type="button" onClick={() => signOut()} className={primaryItemClass}>
              Sign out
            </button>
          ) : (
            <Link href="/auth/signin" className={primaryItemClass}>
              Sign in
            </Link>
          )}
          {onFeed && <SettingsMenu />}
        </nav>
      </div>
    </header>
  );
}
