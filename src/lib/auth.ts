import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkAuthRateLimit } from "@/lib/rate-limit";
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
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        name: { label: "Name", type: "text" },
        isSignUp: { label: "Sign up", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials.password) return null;
        if (credentials.password.length < MIN_PASSWORD) return null;

        const email = credentials.email.trim().toLowerCase();
        const ipHeader = req?.headers?.["x-forwarded-for"];
        const ip = (Array.isArray(ipHeader) ? ipHeader[0] : ipHeader)?.split(",")[0]?.trim() || "unknown";
        if (!checkAuthRateLimit(`${ip}:${email}`)) return null;

        let user = await prisma.user.findUnique({ where: { email } });

        if (credentials.isSignUp === "true") {
          if (user) return null;
          if (!checkAuthRateLimit(`signup:${ip}`)) return null;
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
            },
          });
          // S3-06: fire-and-forget verification email. Failure (Resend
          // outage, missing API key) doesn't block signup — the user
          // can resend from /account later.
          void sendVerificationEmail(user.id, email, user.displayName ?? user.name ?? "Spotter");
          return { id: user.id, name: user.displayName ?? user.name };
        }

        if (!user || !user.passwordHash) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, name: user.displayName ?? user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
  pages: { signIn: "/auth/signin" },
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
};
