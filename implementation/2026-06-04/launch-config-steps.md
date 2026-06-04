# FishSpotter launch config — domain + email runbook

Decided 4 Jun 2026. Two intertwined workstreams: register the domain, then
authenticate transactional email on it. The "cleaner approach": SendGrid is
authenticated on **fishspotter.org** in **Cloudflare DNS** (FROM =
`noreply@fishspotter.org`), not on pebl-cic.co.uk at Wix.

Email **code is already done and deployed** (commit `9b0c0b3`): SendGrid v3 via
fetch, no SDK dependency. `sendEmail()` no-ops gracefully while `SENDGRID_API_KEY`
is unset, so nothing is broken in the meantime. All that remains is accounts +
DNS + env vars.

## Decisions locked
- **Name:** keep FishSpotter (no rebrand). SeaSpotter rejected (live WWF-affiliated
  app at seaspotter.nz).
- **Canonical URL:** `fishspotter.org`. Redirects: `fishspotter.app`,
  `fish-spotter.com`. Free alias: `spot.pebl-cic.co.uk` (CNAME at Wix).
- **Registrar:** Cloudflare Registrar (at-cost, no renewal-trap upsells).
- **Email FROM:** `noreply@fishspotter.org`, name `FishSpotter`.
- **Cost:** ~£32-38/yr domains, £0 upfront. Minimal = fishspotter.org only (~£12/yr).

## Order of operations
1. Register `fishspotter.org` at Cloudflare (brings DNS into Cloudflare).
2. (Optional, anytime) register `fishspotter.app` + `fish-spotter.com`, set 301s.
3. Attach `fishspotter.org` to the Vercel project (Settings -> Domains); paste
   Vercel's records into Cloudflare DNS. Set the redirect domains to 301 ->
   fishspotter.org.
4. SendGrid: create account -> Authenticate Your Domain for fishspotter.org ->
   add its 3 CNAMEs in Cloudflare (**Proxy = DNS only / grey cloud**) -> Verify.
5. SendGrid: create a restricted Mail-Send API key.
6. Set `SENDGRID_API_KEY`, `EMAIL_FROM_ADDRESS=noreply@fishspotter.org`,
   `EMAIL_FROM_NAME=FishSpotter` in `.env.local` and Vercel (Production + Preview).
7. Send a test email to confirm delivery.

## Critical gotchas
- The 3 SendGrid CNAMEs in Cloudflare MUST be **DNS only (grey cloud)**, never
  proxied (orange). Proxied = SendGrid can't verify and mail won't authenticate.
- A brand-new domain has no sending reputation. Fine for low-volume transactional
  mail (verification + password reset) once SPF/DKIM are set by SendGrid. Don't
  blast bulk mail from it on day one.
- Regenerate any SendGrid/Twilio 2FA recovery code that was ever pasted into chat.

## Still gating PRODUCTION launch (separate from email)
- Legal: solicitor review of privacy/terms; sign the DPIA + LIA `[TO COMPLETE]`
  fields (docs in `docs/compliance/` + `src/data/legal/`).
- OAuth (Google/Apple) credentials -> Vercel env, if social sign-in at launch.
- After R2 confirmed serving in prod for a few days, drop old Supabase storage
  objects.

## Fallback (if domain not ready and email is needed sooner)
Authenticate SendGrid on `pebl-cic.co.uk` at **Wix** instead (Wix allows CNAME
adds), FROM = `noreply@pebl-cic.co.uk`. Same SendGrid steps, different DNS host.
