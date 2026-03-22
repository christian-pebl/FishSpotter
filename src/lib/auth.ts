import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

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
      async authorize(credentials) {
        if (!credentials?.email) return null;
        let user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (credentials.isSignUp === "true") {
          if (user) return null;
          user = await prisma.user.create({
            data: {
              email: credentials.email,
              name: credentials.name ?? credentials.email.split("@")[0],
              displayName: credentials.name ?? credentials.email.split("@")[0],
            },
          });
          return { id: user.id, email: user.email, name: user.displayName ?? user.name };
        }
        if (!user) return null;
        return { id: user.id, email: user.email, name: user.displayName ?? user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
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
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
};
