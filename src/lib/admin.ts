import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL_SUFFIX = "@pebl-cic.co.uk";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(ADMIN_EMAIL_SUFFIX);
}

// The session token only carries `id` and `name` (see auth.ts JWT callback),
// so we look the email up by id rather than widening the token surface for
// one rarely-used gate.
export async function getAdminSession() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!isAdminEmail(user?.email)) return null;
  return { session, email: user!.email };
}

export async function requireAdminSession() {
  const admin = await getAdminSession();
  if (!admin) redirect("/");
  return admin;
}
