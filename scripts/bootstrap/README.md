# `scripts/bootstrap/` — operator bootstrap kit

Goal: collapse every "fetch this token, click that button" residual action into a single repeatable command. Run once after token fetch, run again any time you want to verify drift.

## What it does

| Module | What it touches | Idempotent? |
|---|---|---|
| `cloudflare-r2` | Ensures the R2 bucket exists | Yes |
| `vercel-env` | Upserts every env var (Production + Preview) | Yes |
| `github-secrets` | Mirrors selected secrets to GitHub Actions via `gh secret set` | Yes |
| `cloudflare-dns` | Fetches DKIM/SPF/DMARC records from Resend, applies them on Cloudflare DNS | Yes |
| `db` | Runs `npm run db:push → db:seed-aliases → (optional) db:migrate-to-r2` | Yes |
| `doctor` | Read-only state check across all the above | Yes |

Pure modules produce values on every run rather than persisting them:
- `cron-secret.ts` — fresh `CRON_SECRET` each run; pushed to Vercel + GH Actions
- `vapid.ts` — fresh VAPID keypair; pushed to Vercel as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`

This means every `npm run bootstrap` invocation rotates `CRON_SECRET` and VAPID. If you want them stable across runs, persist whatever the first run printed and add them to `.env.local`; future runs will overwrite the Vercel value but the GH Actions secret will match what your local `.env.local` says.

## One-time prerequisites

| Item | Where | Effort |
|---|---|---|
| Cloudflare account | dash.cloudflare.com | ~5 min |
| Vercel account + project deployed | vercel.com | (already done if FishSpotter is live) |
| GitHub `gh` CLI authenticated | `gh auth login` | ~2 min |
| Resend account | resend.com | ~5 min (email confirm) |

All of these are inherently human-in-the-loop (email confirmations, T&C clicks). Everything downstream is scripted.

## Setup

```bash
cp scripts/bootstrap/tokens.json.example scripts/bootstrap/tokens.json
# edit tokens.json with the five tokens you minted
npm run bootstrap -- --doctor   # see what's currently set vs missing
```

## Run

```bash
npm run bootstrap                       # full sequence (no R2 data migration)
npm run bootstrap -- --r2-migration     # full + db:migrate-to-r2
npm run bootstrap -- --only vercel,github  # subset
npm run bootstrap -- --doctor           # read-only drift check
```

## Module choices

`--only` accepts a comma-separated list of: `doctor`, `secrets`, `r2`, `dns`, `vercel`, `github`, `db`.

## Output values you'll want to keep

The first successful run prints (truncated):

```
ℹ CRON_SECRET generated this run: a1b2c3d4… (64 chars)
ℹ VAPID public key: BMlzx7yK7L9eJq…
```

The full values are pushed to Vercel and GitHub Actions. They aren't written back to `tokens.json` (deliberately — `tokens.json` is *inputs only*). If you need them locally for development, copy them from the Vercel dashboard into your `.env.local`.

## What stays manual even with this kit

- **Resend account creation + ToS click** — Resend doesn't support API-driven signup.
- **PEBL privacy + terms legal copy** — written by counsel, not by code.
- **Apple Developer Program enrolment** — Apple has no public automation.
- **Google OAuth consent-screen verification** — Google reviewers, human form-fill.
- **DNS records if your zone isn't on Cloudflare** — the script tells you what records to set; you copy them into whichever control panel owns the zone.

## Architecture notes

- All API clients accept a `fetchImpl` constructor option so unit tests can mock the network.
- All clients accept a `baseUrl` so tests can point at a local stub.
- Every API call has explicit error handling — the orchestrator surfaces the API's own error message rather than wrapping it in a vague "request failed".
- The orchestrator is purely additive — every module is a no-op if its required tokens are missing. Order in `index.ts` doesn't matter for correctness, only for clarity of output.
