/**
 * S8-T1 — anonymous-shuffle seed cookie.
 *
 * Mints `fs.anon_seed` on the first request to `/` or `/feed/*` if the
 * visitor doesn't already have one. The seed is just a stable random
 * string used as input to the deterministic shuffle in
 * `src/lib/feed-ordering.ts` — no secrets, no PII, no need for httpOnly.
 *
 * Signed-in users ignore this cookie (their seed is `session.user.id`),
 * but we still mint it so a sign-out → anon transition doesn't suddenly
 * flip the feed into the chronological default.
 *
 * Runs in the Edge runtime by default, so we use Web Crypto
 * (`crypto.getRandomValues`) rather than Node's `randomBytes`.
 */

import { NextResponse, type NextRequest } from "next/server";

const SEED_COOKIE = "fs.anon_seed";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Q4-A-3: NextAuth sets one of these cookies once the user is signed in
// (the prefix differs depending on whether the deployment uses secure
// cookies, e.g. on Vercel). We can't call `getServerSession` from edge
// middleware without pulling in the auth handler — checking for the
// cookie's existence is a cheap, accurate proxy. False positives just
// mean an already-expired session bounces to /feed and then to /auth,
// which is the same UX as before.
const SESSION_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

function generateSeed(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hasSession(req: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => req.cookies.has(name));
}

export function middleware(req: NextRequest) {
  // Q4-A-3: when a signed-in user hits the marketing homepage, redirect
  // them straight to /feed. Without this they land on the landing page
  // every visit and have to click "Start spotting" to get back into the
  // app — kills the daily-driver habit per the journey review.
  if (req.nextUrl.pathname === "/" && hasSession(req)) {
    const dest = req.nextUrl.clone();
    dest.pathname = "/feed";
    return NextResponse.redirect(dest);
  }

  if (req.cookies.has(SEED_COOKIE)) return NextResponse.next();
  const res = NextResponse.next();
  res.cookies.set(SEED_COOKIE, generateSeed(), {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
  return res;
}

// Narrow matcher so middleware only fires on the two routes that
// actually consume the seed — keeps cold-start cost off API + asset
// paths.
export const config = {
  matcher: ["/", "/feed/:path*"],
};
