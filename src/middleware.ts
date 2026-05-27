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

function generateSeed(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function middleware(req: NextRequest) {
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
