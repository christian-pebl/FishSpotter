# Residual actions after Sprint 1 + cost-opt PRs

Everything code-side has shipped to `main`. Three external-infra steps remain to actually realise the cost savings PRs #5 and #6 unlocked. None require code changes.

## 1. Cloudflare R2 cutover (~10 min) — kills the $25/mo Supabase egress line

Full walkthrough is in `CLAUDE.md` under "Cloudflare R2 setup". Short version:

1. **Cloudflare dashboard → R2 → Create bucket**, name it `fishspotter-snippets`. Enable public access (either the auto-generated `pub-<hash>.r2.dev` URL or a custom domain like `snippets.fish-spotter.com`).
2. **R2 → Manage R2 API Tokens → Create**, scope **Object Read & Write** to the new bucket. Copy the Access Key ID + Secret (shown once).
3. **Add env vars** to Vercel (Production + Preview) AND your local `.env.local`:
   ```
   STORAGE_PROVIDER=r2
   R2_ACCOUNT_ID=<from Cloudflare dashboard, top-right>
   R2_ACCESS_KEY_ID=<from step 2>
   R2_SECRET_ACCESS_KEY=<from step 2>
   R2_BUCKET_NAME=fishspotter-snippets
   R2_PUBLIC_URL=https://pub-<hash>.r2.dev    # no trailing slash
   ```
4. **Run the migration locally**:
   ```
   npm run db:migrate-to-r2 -- --dry-run     # preview what will move
   npm run db:migrate-to-r2 -- --limit 3     # spot-check on 3 clips
   npm run db:migrate-to-r2                  # full migration (idempotent)
   ```
5. **Verify**: load any snippet on the live site; view-source should show the video URL pointing at the R2 domain.
6. **After a few days of healthy R2 traffic**, drop the Supabase Storage objects via the Supabase dashboard. The DB rows already point at R2; the Supabase objects are dead weight.

## 2. Optional: Anthropic model downgrade (~30 sec) — saves another ~$5/mo on Claude

The ID-guide chat is structured tool-orchestration with short replies — Haiku 4.5 handles it well and is ~3× cheaper than Sonnet 4.6.

Set in Vercel env (Production + Preview):
```
ANTHROPIC_MODEL=claude-haiku-4-5
```

A/B-test on 2-3 sample chats first to confirm conversational tone is acceptable. Revert by removing the env var (the default is Sonnet 4.6).

## 3. Vercel secrets for the new CI workflows (one-time, optional)

The Playwright, Lighthouse, and codec-guard workflows added by Lane D need a few existing secrets to be available to GitHub Actions. If your repo Actions secrets are already populated (e.g. for the earlier `bootstrap-image-cache.yml` workflow), this is a no-op.

Required if not already set:
- `NEXTAUTH_SECRET`
- `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

Optional:
- `LHCI_GITHUB_APP_TOKEN` — inline PR check comments from Lighthouse CI

---

## Cost summary after all three actions

| | Before any of this work | After Sprint 1 + #5 only | + R2 cutover (action 1) | + Haiku (action 2) |
|---|---|---|---|---|
| Supabase | $25 | $25 | **$0** | $0 |
| Anthropic | ~$14 | ~$8.50 | ~$8.50 | **~$2-3** |
| Vercel | $0 | $0 | $0 | $0 |
| **Total** | **~$39/mo** | **~$33/mo** | **~$8.50/mo** | **~$2-3/mo** |

---

## What's next, code-wise

Sprint 1 is closed. The plan covers six sprints; pick up Sprint 2 (quiz pipeline, 20 tickets) when you're ready. Before starting, the plan parks 8 product decisions that gate later sprints — most relevantly:

- **Q2** Email provider (Resend recommended) — blocks Sprint 3 from S3-T03 onwards
- **Q3** Anonymous-first answer flow — blocks S2-T11 / S3-T15
- **Q5** Captions posture — blocks S6-T19

Decisions table is in [00-README.md](00-README.md) under "Product decisions that gate execution".
