/**
 * The admin mailbox domain, on its own so pure code can ask the question
 * without importing the session machinery in ./admin.
 *
 * `isAdminUser` (./admin) grants admin to a verified address on this domain.
 * Anything that can mark an address verified has to know about that, which
 * is why the password-setup route checks this before it confirms an email.
 */
export const ADMIN_EMAIL_SUFFIX = "@pebl-cic.co.uk";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(ADMIN_EMAIL_SUFFIX);
}
