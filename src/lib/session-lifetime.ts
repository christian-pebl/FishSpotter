/**
 * How long a login lasts after the last visit, per kind of account.
 *
 * Members (and staff, who are always members) keep the seven days this app has
 * always used. A guest has no email or password to sign back in with, so when
 * a guest login lapses the account, its Pebbles and its streak are lost for
 * good and the person comes back as a stranger. The 7 Oct 2026 engagement
 * check found exactly that: a guest returning after a week was counted as a
 * brand-new spotter. Ninety days keeps a weekly club session, or a monthly
 * clip drop, inside one login.
 *
 * Mechanics (src/lib/auth.ts): the session cookie lives for the longest of the
 * two (`session.maxAge`), and the JWT inside it carries its own expiry from
 * `sessionMaxAgeFor`. next-auth rejects a token past its expiry (jose's
 * jwtDecrypt checks `exp`) and clears the cookie, so a member is still signed
 * out after seven idle days, exactly as before.
 */

export const MEMBER_SESSION_SECONDS = 7 * 24 * 60 * 60;
export const GUEST_SESSION_SECONDS = 90 * 24 * 60 * 60;

/** The cookie has to outlive every token it might carry. */
export const SESSION_COOKIE_SECONDS = Math.max(MEMBER_SESSION_SECONDS, GUEST_SESSION_SECONDS);

/**
 * The token lifetime for this account. Anything not positively a guest gets
 * the member lifetime, so a malformed or missing token can only ever get the
 * shorter login.
 */
export function sessionMaxAgeFor(token: { isGuest?: boolean } | null | undefined): number {
  return token?.isGuest === true ? GUEST_SESSION_SECONDS : MEMBER_SESSION_SECONDS;
}
