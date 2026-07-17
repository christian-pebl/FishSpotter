import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL_SUFFIX = "@pebl-cic.co.uk";

// Admin requires a @pebl-cic.co.uk email AND a verified one (emailVerified
// non-null). The domain check alone is not enough: POST /api/guest/claim
// lets any signed-in guest write an arbitrary unclaimed address into
// User.email (with emailVerified left null) without ever proving they
// received the confirmation link, so a guest could claim
// "anything@pebl-cic.co.uk" and self-escalate to admin in three requests.
// Requiring emailVerified closes that path since guest-claim never sets it.
export function isAdminUser(
  user: { email?: string | null; emailVerified?: Date | null } | null | undefined,
): boolean {
  if (!user?.email || !user.emailVerified) return false;
  return user.email.trim().toLowerCase().endsWith(ADMIN_EMAIL_SUFFIX);
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
    select: { email: true, emailVerified: true },
  });
  if (!isAdminUser(user)) return null;
  return { session, email: user!.email };
}

export async function requireAdminSession() {
  const admin = await getAdminSession();
  if (!admin) redirect("/");
  return admin;
}
