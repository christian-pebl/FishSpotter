"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { PwaInstallButton } from "@/components/PwaInstallButton";
import { isSoundsEnabled, setSoundsEnabled } from "@/lib/sounds";

export function Header() {
  const { data: session, status } = useSession();
  const [streak, setStreak] = useState<number | null>(null);
  const [soundsOn, setSoundsOn] = useState(true);

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

  return (
    <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]/88 px-4 py-2 backdrop-blur">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
        <Link href="/" className="shrink-0 flex flex-col gap-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/PEBL Logo-1.svg"
            alt="PEBL FishSpotter"
            className="h-7 w-auto md:h-10"
          />
          <span className="hidden md:block text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
            FishSpotter
          </span>
        </Link>
        <nav className="flex items-center gap-1.5 md:gap-2">
          <Link href="/feed" className="hidden md:inline-flex pebl-button-secondary rounded-full px-3 py-1.5 text-sm font-medium">
            Live feed
          </Link>
          <Link href="/feed/browse" className="hidden md:inline-flex pebl-button-secondary rounded-full px-3 py-1.5 text-sm font-medium">
            Archive
          </Link>
          <Link href="/leaderboard" className="hidden md:inline-flex pebl-button-secondary rounded-full px-3 py-1.5 text-sm font-medium">
            Community
          </Link>
          {session && (
            <Link href="/me/taxa" className="hidden md:inline-flex pebl-button-secondary rounded-full px-3 py-1.5 text-sm font-medium">
              My taxa
            </Link>
          )}
          <PwaInstallButton />
          <button
            type="button"
            onClick={() => {
              setSoundsEnabled(!soundsOn);
              setSoundsOn(!soundsOn);
            }}
            className="pebl-button-secondary rounded-full px-2.5 py-1.5 text-sm font-medium"
            title={soundsOn ? "Mute sounds" : "Unmute sounds"}
            aria-label={soundsOn ? "Mute sounds" : "Unmute sounds"}
          >
            <span className="hidden md:inline">{soundsOn ? "Sound on" : "Sound off"}</span>
            <span className="md:hidden" aria-hidden>{soundsOn ? "🔊" : "🔇"}</span>
          </button>
          {session && streak !== null && streak > 0 && (
            <motion.span
              className="flex items-center gap-1 rounded-full border border-[color:var(--primary)]/20 bg-[color:var(--surface-muted)] px-2.5 py-1.5 text-sm font-medium text-[color:var(--primary)]"
              title="Current streak"
              animate={{ scale: [1, 1.12, 1] }}
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
            <button
              type="button"
              onClick={() => signOut()}
              className="pebl-button-primary rounded-full px-3 py-1.5 text-sm font-semibold"
            >
              Sign out
            </button>
          ) : (
            <Link href="/auth/signin" className="pebl-button-primary rounded-full px-3 py-1.5 text-sm font-semibold">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
