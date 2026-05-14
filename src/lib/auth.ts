import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkAuthRateLimit } from "@/lib/rate-limit";

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET is required");
}

const MIN_PASSWORD = 8;
const BCRYPT_ROUNDS = 12;

export const authOptions: NextAuthOptions = {
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
          const fallback = email.split("@")[0].slice(0, 32);
          const passwordHash = await bcrypt.hash(credentials.password, BCRYPT_ROUNDS);
          user = await prisma.user.create({
            data: {
              email,
              passwordHash,
              name: cleanName || fallback,
              displayName: cleanName || fallback,
            },
          });
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
