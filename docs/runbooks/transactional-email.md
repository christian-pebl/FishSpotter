# Runbook: transactional email (verification, password reset, digests)

The one thing to remember: **the app can only tell you an email was accepted by
SendGrid, never that it arrived.** Everything below is about closing that gap
quickly when someone writes in with "I never get the verification email".

> **TL;DR (a spotter says the email never comes):**
> 1. `curl -s https://www.fishspotter.app/api/health` → `"email": "configured"`?
> 2. Open **/admin/email** (signed in as `@pebl-cic.co.uk`, verified): read the
>    verdict under "Are verification emails getting through?", then press
>    **Send a test email** and read SendGrid's answer verbatim.
> 3. If the test send is accepted but nothing arrives: SendGrid → Activity, search
>    the address. If it is refused: the reason is in the message (key or sender).
> 4. Verify the spotter by hand (section 6) so they are not waiting on the fix.

---

## 1. How it is wired

| Piece | File | Notes |
|---|---|---|
| Sender | `src/lib/email/send.ts` | SendGrid v3 REST via `fetch`, no SDK. Never throws. 10 s timeout. |
| Config | `src/lib/email/client.ts` | `getEmailConfig()` / `isEmailConfigured()`: reads `SENDGRID_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO` on every call. |
| Result contract | `src/lib/email/outcome.ts` | `sendOutcome(result)` is `sent`, `not-configured` or `failed`. **`result.ok` alone is not "sent"**: an unconfigured provider returns `ok: true, skipped: true` so a caller's own transaction is never rolled back. Anything that tells a person "check your inbox" must use `wasSent()`. |
| Verification dispatch | `src/lib/email/dispatch.ts` | Mints the token, sends, returns the result. Mints nothing when unconfigured. |
| Templates | `src/lib/email/templates/*.tsx` | React Email. `TestEmail.tsx` is the admin test send. |
| Delivery figures | `src/lib/email/verification-stats.ts` | Pure: requested vs. clicked from `VerificationToken` rows. |
| Diagnostics page | `src/app/admin/email/` | Config status, delivery figures, test send. |

Where each email is sent from, and what happens when it cannot be:

| Email | Sent from | On non-delivery |
|---|---|---|
| Signup verification | `authorize()` in `src/lib/auth.ts`, **awaited** (an un-awaited promise on a serverless runtime can be frozen with the function; that is how first emails went missing) | Signup still succeeds; logged; the feed banner and account page offer a resend. |
| Resend verification | `POST /api/auth/verify-request` | **503** with `EMAIL_UNAVAILABLE_MESSAGE`; the UI says "Could not send" and names `hello@pebl-cic.co.uk`. Checked before the rate limit, so five honest 503s never become a 429. |
| Password reset | `POST /api/auth/forgot` | **503** for every address when the provider is unconfigured (leaks nothing: it is the same for everyone). A per-send provider failure for a real account still answers the generic 200 (a 503 only for existing addresses would be an enumeration oracle) and is logged. |
| Guest claim (set-a-password link) | `POST /api/guest/claim` | The claim is saved; the response carries `emailSent: false` and the prompt says how to finish by hand. |
| Weekly digest, new clips, streak nudge | `/api/cron/*` | Counted as failed in the cron's own tally. |
| Staff comment notification | `src/lib/email/comment-notify.ts` | Counted as not sent. |

Verification links point at `SITE_URL` (`src/lib/site-url.ts`), which is
`https://www.fishspotter.app` unless `NEXT_PUBLIC_SITE_URL` overrides it.

## 2. Env vars, and the two traps

```
SENDGRID_API_KEY=SG....             # a restricted "Mail Send" key
EMAIL_FROM_ADDRESS=noreply@fishspotter.app   # MUST be a sender SendGrid has authenticated
EMAIL_FROM_NAME=FishSpotter
EMAIL_REPLY_TO=hello@pebl-cic.co.uk
EMAIL_PREVIEW_CATCHALL=...          # preview deploys only: every message is redirected here
```

Both `SENDGRID_API_KEY` and `EMAIL_FROM_ADDRESS` must be set in **Vercel →
Production**. Two traps, both hit before:

1. **A new env var does not reach an already-built deployment.** Redeploy after
   setting one. (`/api/health` reads the running deployment, so it tells you
   whether the redeploy happened.)
2. **The from address has to be one SendGrid has verified**, either the whole
   domain (Settings → Sender Authentication → Authenticate Your Domain, three
   CNAMEs in Cloudflare set to **DNS only / grey cloud**, never proxied) or a
   Single Sender. Otherwise every send is refused with a 403 naming "a verified
   Sender Identity", which the test send on /admin/email will quote back.

The original decision record for domain and email setup is
`implementation/2026-06-04/launch-config-steps.md`.

## 3. Diagnosing "I never get the email", in order

1. **Configured at all?** `curl -s https://www.fishspotter.app/api/health`.
   `"email": "unconfigured"` means one or both vars are missing on the running
   deployment; nothing has been sent to anyone since that deploy, and the app
   has been telling spotters so (the 503 path above).
2. **Getting through?** `/admin/email`, section 2. "Requested" is every
   verification token minted in the window, "clicked" is every one consumed by
   a real click. Three or more requested and none clicked is a sender that is
   configured but not delivering, or every message landing in spam. (A click is
   a consumed token whose owner's `emailVerified` was stamped in the same
   moment; tokens retired by the old resend behaviour do not count.)
3. **Accepted right now?** `/admin/email`, section 3, send yourself a test
   email. The three answers:
   - *SendGrid accepted the message*: now check the inbox and spam. If nothing
     arrives, SendGrid → Activity, search your address: a bounce, a block or a
     "deferred" line names the reason.
   - *Nothing was sent: the provider is not configured*: section 2 above.
   - *SendGrid refused it*, with the status and body: 401 is a bad or revoked
     key; 403 naming a sender identity is the from address (section 2, trap 2).
4. **Landing in spam?** The domain needs SPF and DKIM (SendGrid's domain
   authentication provides both) and a DMARC record (`_dmarc.fishspotter.app`,
   `v=DMARC1; p=none; rua=mailto:...` is enough to start). Big providers junk
   or reject mail from domains without them.
5. **Preview deployment?** On any non-production Vercel deployment every email
   goes to `EMAIL_PREVIEW_CATCHALL` (or nowhere, if unset). Demo from the
   production URL.

Vercel's function logs carry every non-delivery as `[email] ...` at error
level, with the recipient's domain only, never the mailbox.

## 4. What a spotter sees now

- The resend button says **"Email sent"** only when SendGrid accepted the
  message, and then adds "give it a minute, check spam, or email
  hello@pebl-cic.co.uk from this address and we will verify you by hand".
- When nothing could be sent it says **"Could not send"** with the same way
  out, instead of a success it cannot back up.
- The account page shows the "not arrived?" line under the button before
  anything is pressed, because that is the page a puzzled person ends up on.

## 5. Tests

```
npx vitest run src/lib/email/
```

`send.test.ts` exercises the sender against a stubbed `fetch` (unconfigured,
accepted, 403 refused, network error, preview catch-all); `outcome.test.ts`
pins the result contract; `verification-stats.test.ts` pins the delivery
figures, including that resend-retired tokens never count as clicks.

## 6. Verifying a spotter by hand

Someone who emails `hello@pebl-cic.co.uk` **from the address on their account**
has proved they control that inbox as well as a click would. Check the sender
address matches the account exactly, then:

```sql
UPDATE "User"
SET "emailVerified" = now()
WHERE lower(email) = lower('spotter@example.com')
  AND "emailVerified" IS NULL
  AND "isGuest" = false;
```

Reply to tell them it is done; the "Unverified" badge on their account page
clears on the next load. Do not do this for an address that wrote in from a
different mailbox.
