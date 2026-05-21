"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { PwaInstallButton } from "@/components/PwaInstallButton";
import { isSoundsEnabled, setSoundsEnabled } from "@/lib/sounds";

interface SideMenuProps {
  open: boolean;
  onClose: () => void;
}

interface NavItem {
  href: string;
  label: string;
  match: (path: string) => boolean;
  icon: React.ReactNode;
}

const NAV: NavItem[] = [
  {
    href: "/feed",
    label: "Live feed",
    match: (p) => p === "/feed",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="2" y="3" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M6 6l4 2.5-4 2.5V6z" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/feed/browse",
    label: "Archive",
    match: (p) => p.startsWith("/feed/browse"),
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="2" y="3" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
        <rect x="9" y="3" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
        <rect x="2" y="10" width="5" height="3.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
        <rect x="9" y="10" width="5" height="3.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    match: (p) => p.startsWith("/leaderboard"),
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M4 13V8m4 5V4m4 9v-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function SideMenu({ open, onClose }: SideMenuProps) {
  const { data: session, status } = useSession();
  const pathname = usePathname() ?? "/";
  const reduceMotion = useReducedMotion();
  const [soundsOn, setSoundsOn] = useState(true);
  const [streak, setStreak] = useState<number | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

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

  // Body scroll lock + initial focus + Escape close + focus trap (S5-T11).
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 30);

    // Remember what had focus before the drawer opened so we can
    // restore it on close — same pattern SpeciesGallery uses.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = drawerRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm"
            aria-hidden
          />
          <motion.aside
            key="drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
            initial={reduceMotion ? false : { x: "-100%" }}
            animate={{ x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: "-100%" }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed left-0 top-0 z-50 flex h-[100dvh] w-[min(85vw,320px)] flex-col overflow-y-auto bg-navy-900 text-white shadow-drawer"
            style={{
              paddingTop: `max(0.75rem, env(safe-area-inset-top))`,
              paddingBottom: `max(1rem, env(safe-area-inset-bottom))`,
            }}
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-2 px-4 pb-3">
              <Link href="/" onClick={onClose} className="inline-flex flex-col gap-0.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/branding/PEBL Logo-1.svg" alt="PEBL" className="h-8 w-auto" />
                <span className="text-[10px] uppercase tracking-eyebrow text-teal-50/70">
                  FishSpotter
                </span>
              </Link>
              <button
                type="button"
                ref={closeBtnRef}
                onClick={onClose}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/18"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path
                    d="M3 3L11 11M11 3L3 11"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* Account block */}
            {session?.user && (
              <div className="border-t border-white/10 px-4 py-3 text-sm">
                <p className="font-semibold text-white">
                  {session.user.name ?? session.user.email ?? "Signed in"}
                </p>
                {session.user.email && (
                  <p className="truncate text-xs text-white/55">{session.user.email}</p>
                )}
                {streak !== null && streak > 0 && (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-teal-500">
                    <span aria-hidden>🔥</span> {streak} day streak
                  </p>
                )}
              </div>
            )}

            {/* Nav */}
            <nav className="border-t border-white/10 px-2 py-2" aria-label="Primary">
              <ul className="flex flex-col gap-0.5">
                {NAV.map((item) => {
                  const active = item.match(pathname);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                          active
                            ? "bg-teal-500/20 text-teal-50"
                            : "text-white/80 hover:bg-white/8 hover:text-white"
                        }`}
                        aria-current={active ? "page" : undefined}
                      >
                        <span className={active ? "text-teal-500" : "text-white/55"}>
                          {item.icon}
                        </span>
                        <span className="flex-1">{item.label}</span>
                        {active && (
                          <span className="text-[10px] uppercase tracking-wider text-teal-500">
                            Now
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Tools */}
            <div className="border-t border-white/10 px-4 py-3">
              <button
                type="button"
                role="switch"
                aria-checked={soundsOn}
                onClick={() => {
                  setSoundsEnabled(!soundsOn);
                  setSoundsOn(!soundsOn);
                }}
                className="flex w-full items-center justify-between rounded-lg py-2 text-sm hover:opacity-90"
              >
                <span className="flex items-center gap-3">
                  <span className="text-white/55">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M3 6h2l3-2.5v9L5 10H3V6z"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="text-white/85">UI sounds</span>
                </span>
                <span
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    soundsOn ? "bg-teal-500" : "bg-white/15"
                  }`}
                >
                  <span
                    className="absolute h-4 w-4 rounded-full bg-white shadow"
                    style={{ transform: soundsOn ? "translateX(18px)" : "translateX(2px)" }}
                  />
                </span>
              </button>
              <div className="mt-2">
                <PwaInstallButton />
              </div>
            </div>

            {/* Account actions */}
            <div className="mt-auto border-t border-white/10 px-4 py-3 text-sm">
              {status === "loading" ? (
                <span className="text-white/55">…</span>
              ) : session ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    void signOut();
                  }}
                  className="w-full rounded-full border border-white/20 px-3 py-2 text-sm font-medium text-white hover:border-teal-500"
                >
                  Sign out
                </button>
              ) : (
                <Link
                  href="/auth/signin"
                  onClick={onClose}
                  className="block w-full rounded-full bg-teal-500 px-3 py-2 text-center text-sm font-semibold text-navy-900 hover:bg-teal-400"
                >
                  Sign in
                </Link>
              )}
              <p className="mt-3 text-center text-[10px] uppercase tracking-eyebrow text-white/30">
                PEBL CIC
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
