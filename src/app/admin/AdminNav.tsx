"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin/snippets", label: "Clips & tracks" },
  { href: "/admin/species", label: "Species marks" },
  { href: "/admin/comments", label: "Feedback" },
  { href: "/admin/metrics", label: "Metrics" },
  { href: "/admin/trust", label: "Trust" },
];

// Touch-friendly admin nav: pill links (>=44px tall) that scroll horizontally
// on narrow phones instead of wrapping into a cramped row, with an active-state
// highlight so it's obvious where you are.
export function AdminNav({ unreadComments = 0 }: { unreadComments?: number }) {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none]">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium transition ${
              active
                ? "bg-teal-600 text-white"
                : "bg-navy-100 text-navy-700 hover:bg-navy-200"
            }`}
          >
            {link.label}
            {link.href === "/admin/comments" && unreadComments > 0 && (
              <span
                className={`ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                  active ? "bg-white text-teal-700" : "bg-teal-600 text-white"
                }`}
              >
                {unreadComments > 99 ? "99+" : unreadComments}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
