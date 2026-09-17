import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { clientIpKeyFromHeaders } from "@/lib/client-ip";
import { sendVerificationEmail } from "@/lib/email/dispatch";
import { wasSent } from "@/lib/email/outcome";
import {
  AGE_UNKNOWN,
  defaultLeaderboardOptIn,
  isUnder13,
  parseAgeBand,
  placeholderEmail,
  toAgeBandOrUnknown,
} from "@/lib/age";
import { isGeneratedNickname } from "@/lib/nickname";
import { consumeChildSignInToken } from "@/lib/parental-consent";

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET is required");
}

const MIN_PASSWORD = 8;
const BCRYPT_ROUNDS = 12;

// S3-02: PrismaAdapter is wired but session strategy stays `jwt` so the
// Credentials provider keeps working unchanged. The adapter is dormant
// for credentials users (no rows in Account / Session); it activates
// the moment a future ticket drops an OAuth provider into `providers`.
// Build optional OAuth providers, only added when credentials are present so
// the app boots cleanly in dev/CI without them configured.
const oauthProviders: NextAuthOptions["providers"] = [
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
      ]
    : []),
  ...(process.env.APPLE_CLIENT_ID &&
  process.env.APPLE_CLIENT_SECRET &&
  process.env.APPLE_TEAM_ID &&
  process.env.APPLE_PRIVATE_KEY
    ? [
        AppleProvider({
          clientId: process.env.APPLE_CLIENT_ID,
          clientSecret: process.env.APPLE_CLIENT_SECRET,
        }),
      ]
    : []),
];

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    ...oauthProviders,
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        name: { label: "Name", type: "text" },
        isSignUp: { label: "Sign up", type: "text" },
        ageBracket: { label: "Age band", type: "text" },
        guest: { label: "Guest", type: "text" },
        childLink: { label: "Parent sign-in link", type: "text" },
      },
      async authorize(credentials, req) {
        const clientIp = clientIpKeyFromHeaders(req?.headers);

        // A parent signing this device in as their under-13 child, from the
        // parent page (/parent/manage/[token]). The token is single-use, lives
        // for minutes, and only works for a parent holding a granted account
        // consent (src/lib/parental-consent.ts).
        if (credentials?.childLink) {
          if (!(await checkAuthRateLimit(`childlink:${clientIp}`))) return null;
          const childId = await consumeChildSignInToken(prisma, credentials.childLink, new Date());
          if (!childId) return null;
          const child = await prisma.user.findUnique({
            where: { id: childId },
            select: { id: true, displayName: true, name: true, ageBracket: true },
          });
          if (!child) return null;
          return {
            id: child.id,
            name: child.displayName ?? child.name,
            isGuest: true,
            ageBand: toAgeBandOrUnknown(child.ageBracket),
          };
        }

        // Zero-friction guest play: an age band and a username are the ONLY
        // inputs. We mint a lightweight User (synthetic placeholder email +
        // isGuest=true) so the spotter's answers persist at once. They "claim"
        // it later by adding a real email (POST /api/guest/claim), or, for an
        // under-13, through a parent's consent (src/lib/parental-consent.ts).
        //
        // The age band is required (Children's Code, COPPA): it decides
        // whether the name goes on the public leaderboard, and an under-13
        // may only use a nickname we generated, never one they typed, since
        // a child's typed username can be their real name.
        if (credentials?.guest === "true") {
          if (!(await checkAuthRateLimit(`guest:${clientIp}`))) return null;
          const ageBand = parseAgeBand(credentials.ageBracket);
          if (!ageBand) return null;
          const rawName = (credentials.name ?? "").trim().slice(0, 32);
          let displayName: string;
          if (isUnder13(ageBand)) {
            if (!isGeneratedNickname(rawName)) return null;
            displayName = rawName;
          } else {
            const cleanName = rawName.replace(/[^\p{L}\p{N}\s._-]/gu, "").trim();
            displayName = cleanName || `Spotter-${Math.random().toString(36).slice(2, 8)}`;
          }
          const guest = await prisma.user.create({
            data: {
              // Unique placeholder so the non-null @unique email constraint
              // holds without colliding; replaced with a real address on claim.
              email: placeholderEmail(globalThis.crypto.randomUUID()),
              isGuest: true,
              name: displayName,
              displayName,
              ageBracket: ageBand,
              ageDeclaredAt: new Date(),
              // Adults are listed; under-18s start private.
              leaderboardOptIn: defaultLeaderboardOptIn(ageBand),
            },
          });
          return { id: guest.id, name: guest.displayName, isGuest: true, ageBand };
        }

        if (!credentials?.email || !credentials.password) return null;
        if (credentials.password.length < MIN_PASSWORD) return null;

        const email = credentials.email.trim().toLowerCase();
        if (!(await checkAuthRateLimit(`${clientIp}:${email}`))) return null;

        let user = await prisma.user.findUnique({ where: { email } });

        if (credentials.isSignUp === "true") {
          if (user) return null;
          // Children's Code and COPPA: a full account needs a declared band,
          // and an under-13 never gets one with their own email. The signup
          // page sends them to nickname play instead, where a parent's
          // consent saves their progress. The band is the only age data we
          // ever store.
          const ageBand = parseAgeBand(credentials.ageBracket);
          if (!ageBand || isUnder13(ageBand)) return null;
          if (!(await checkAuthRateLimit(`signup:${clientIp}`))) return null;
          const rawName = (credentials.name ?? "").trim().slice(0, 32);
          const cleanName = rawName.replace(/[^\p{L}\p{N}\s._-]/gu, "");
          // S3-15 fallback: anonymous-feeling name when the user
          // doesn't pick one. Random suffix is just for uniqueness,
          // not security; collisions on display names are OK.
          const fallback = `Spotter-${Math.random().toString(36).slice(2, 8)}`;
          const passwordHash = await bcrypt.hash(credentials.password, BCRYPT_ROUNDS);
          user = await prisma.user.create({
            data: {
              email,
              passwordHash,
              name: cleanName || fallback,
              displayName: cleanName || fallback,
              // Store only the coarse band; never a date of birth.
              ageBracket: ageBand,
              ageDeclaredAt: new Date(),
              // Declared minors default OFF the public leaderboard.
              leaderboardOptIn: defaultLeaderboardOptIn(ageBand),
            },
          });
          // S3-06: the verification email is AWAITED, not fire-and-forget. On
          // a serverless runtime an un-awaited promise can be frozen with the
          // function the moment the response is written, so the first email
          // simply never left and the spotter's only clue was a "resend"
          // button. sendVerificationEmail never throws, and a non-delivery
          // does not block signup: they can resend from /account, which now
          // says so when it fails instead of claiming "Email sent".
          const delivery = await sendVerificationEmail(
            user.id,
            email,
            user.displayName ?? user.name ?? "Spotter",
          );
          if (!wasSent(delivery)) {
            // eslint-disable-next-line no-console
            console.error("[auth] signup verification email not delivered", {
              userId: user.id,
              error: delivery.error,
            });
          }
          return {
            id: user.id,
            name: user.displayName ?? user.name,
            isGuest: false,
            ageBand,
          };
        }

        if (!user || !user.passwordHash) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          name: user.displayName ?? user.name,
          isGuest: false,
          ageBand: toAgeBandOrUnknown(user.ageBracket),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.isGuest = (user as { isGuest?: boolean }).isGuest ?? false;
        // OAuth sign-ins arrive without a band; the lookup below fills it.
        const band = (user as { ageBand?: string }).ageBand;
        if (band) token.ageBand = band;
      }
      // After a guest claims their account (POST /api/guest/claim) or anyone
      // declares their age (POST /api/account/age), the client calls
      // session.update() so this re-reads the flags the prompts depend on.
      // A token minted before the age question existed carries no ageBand at
      // all; read it once so AgeCheck knows whether to ask.
      if (token.id && (trigger === "update" || token.ageBand === undefined)) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { isGuest: true, displayName: true, name: true, ageBracket: true },
        });
        if (fresh) {
          token.isGuest = fresh.isGuest;
          token.name = fresh.displayName ?? fresh.name ?? token.name;
          token.ageBand = toAgeBandOrUnknown(fresh.ageBracket);
        } else if (token.ageBand === undefined) {
          token.ageBand = AGE_UNKNOWN;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { isGuest?: boolean }).isGuest = !!token.isGuest;
        (session.user as { ageBand?: string }).ageBand = token.ageBand ?? AGE_UNKNOWN;
      }
      return session;
    },
  },
  pages: { signIn: "/auth/signin" },
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
};
