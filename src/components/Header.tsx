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
    <header className="border-b border-slate-700/50 px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-cyan-400">
          FishSpotter
        </Link>
        <nav className="flex gap-4 items-center">
          <Link href="/feed" className="text-slate-300 hover:text-white">
            Feed
          </Link>
          <Link href="/leaderboard" className="text-slate-300 hover:text-white">
            Leaderboard
          </Link>
          <PwaInstallButton />
          <button
            type="button"
            onClick={() => {
              setSoundsEnabled(!soundsOn);
              setSoundsOn(!soundsOn);
            }}
            className="text-slate-400 hover:text-white p-1 rounded transition"
            title={soundsOn ? "Mute sounds" : "Unmute sounds"}
            aria-label={soundsOn ? "Mute sounds" : "Unmute sounds"}
          >
            {soundsOn ? "🔊" : "🔇"}
          </button>
          {session && streak !== null && streak > 0 && (
            <motion.span
              className="flex items-center gap-1 text-amber-400 text-sm font-medium"
              title="Day streak"
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            >
              <span aria-hidden>🔥</span>
              {streak}
            </motion.span>
          )}
          {status === "loading" ? (
            <span className="text-slate-500 text-sm">…</span>
          ) : session ? (
            <button
              type="button"
              onClick={() => signOut()}
              className="text-slate-300 hover:text-white text-sm"
            >
              Sign out
            </button>
          ) : (
            <Link href="/auth/signin" className="text-slate-300 hover:text-white">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
