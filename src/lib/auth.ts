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

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET is required");
}

const MIN_PASSWORD = 8;
const BCRYPT_ROUNDS = 12;

// S3-02: PrismaAdapter is wired but session strategy stays `jwt` so the
// Credentials provider keeps working unchanged. The adapter is dormant
// for credentials users (no rows in Account / Session); it activates
// the moment a future ticket drops an OAuth provider into `providers`.
// Build optional OAuth providers — only added when credentials are present so
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
      },
      async authorize(credentials, req) {
        const clientIp = clientIpKeyFromHeaders(req?.headers);

        // Zero-friction guest play: a username is the ONLY input. We mint a
        // lightweight User (synthetic placeholder email + isGuest=true) so the
        // spotter's answers persist and they appear on the leaderboard at once.
        // They "claim" it later by adding a real email (POST /api/guest/claim).
        if (credentials?.guest === "true") {
          if (!checkAuthRateLimit(`guest:${clientIp}`)) return null;
          const rawName = (credentials.name ?? "").trim().slice(0, 32);
          const cleanName = rawName.replace(/[^\p{L}\p{N}\s._-]/gu, "").trim();
          const displayName =
            cleanName || `Spotter-${Math.random().toString(36).slice(2, 8)}`;
          // Unique placeholder so the non-null @unique email constraint holds
          // without colliding; replaced with a real address on claim.
          const placeholderEmail = `guest_${globalThis.crypto.randomUUID()}@guest.fishspotter.local`;
          const guest = await prisma.user.create({
            data: {
              email: placeholderEmail,
              isGuest: true,
              name: displayName,
              displayName,
              // No age declared for guests; leaderboard is open to them.
              leaderboardOptIn: true,
            },
          });
          return { id: guest.id, name: guest.displayName, isGuest: true };
        }

        if (!credentials?.email || !credentials.password) return null;
        if (credentials.password.length < MIN_PASSWORD) return null;

        const email = credentials.email.trim().toLowerCase();
        if (!checkAuthRateLimit(`${clientIp}:${email}`)) return null;

        let user = await prisma.user.findUnique({ where: { email } });

        if (credentials.isSignUp === "true") {
          if (user) return null;
          // ICO Children's Code: block under-13 signups outright. The
          // self-declared band is the only age data we ever store.
          if (credentials.ageBracket === "under_13") return null;
          if (!checkAuthRateLimit(`signup:${clientIp}`)) return null;
          const isMinor = credentials.ageBracket === "13_17";
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
              ageBracket:
                credentials.ageBracket === "13_17" ||
                credentials.ageBracket === "18_plus"
                  ? credentials.ageBracket
                  : null,
              // Declared minors default OFF the public leaderboard.
              leaderboardOptIn: !isMinor,
            },
          });
          // S3-06: fire-and-forget verification email. Failure (email
          // provider outage, missing API key) doesn't block signup — the user
          // can resend from /account later.
          void sendVerificationEmail(user.id, email, user.displayName ?? user.name ?? "Spotter");
          return { id: user.id, name: user.displayName ?? user.name, isGuest: false };
        }

        if (!user || !user.passwordHash) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, name: user.displayName ?? user.name, isGuest: false };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.isGuest = (user as { isGuest?: boolean }).isGuest ?? false;
      }
      // After a guest claims their account (POST /api/guest/claim), the client
      // calls session.update() so this re-reads the now-false isGuest flag and
      // the guest-save prompt stops firing.
      if (trigger === "update" && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { isGuest: true, displayName: true, name: true },
        });
        if (fresh) {
          token.isGuest = fresh.isGuest;
          token.name = fresh.displayName ?? fresh.name ?? token.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { isGuest?: boolean }).isGuest = !!token.isGuest;
      }
      return session;
    },
  },
  pages: { signIn: "/auth/signin" },
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
};
