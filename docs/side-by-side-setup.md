# Running both versions side-by-side

Two Next.js apps live on this machine, both pointing at the same Supabase project:

| URL | What | Source path | Branch |
|---|---|---|---|
| **http://localhost:3000** | Our enhanced version (lean Phase 1 + ID Guide + OBIS prior + map + tracker + …) | `C:\Users\Christian Abulhawa\FishSpotter\` | `main` (uncommitted) |
| **http://localhost:3001** | mgtaco's exact baseline (commit `121bdab` "Fixed issues") | `C:\Users\Christian Abulhawa\FishSpotter-mgtaco-baseline\` | `baseline-mgtaco` (git worktree) |

## How it was set up

The baseline is a **git worktree** — same git repo, separate working directory at a different commit:

```bash
git worktree add ../FishSpotter-mgtaco-baseline -b baseline-mgtaco 121bdab
```

Both worktrees share the same `.git/` and remotes. Working changes in either are isolated.

## How to start them

```bash
# Enhanced (3000)
cd "C:/Users/Christian Abulhawa/FishSpotter"
npm run dev

# Baseline (3001)
cd "C:/Users/Christian Abulhawa/FishSpotter-mgtaco-baseline"
PORT=3001 npm run dev
```

Both auto-pick up their own `.env.local`. The baseline's `NEXTAUTH_URL` is `http://localhost:3001` so session cookies land on the right port.

## Database

Both apps point at the same Supabase project (`aazxphcrexkggbmmceli`).

**Why that works:** mgtaco's Prisma schema is a *subset* of ours. Prisma in the baseline doesn't know about `Taxon`, `TaxonAttribute`, `BiogeographicChecklist`, etc., but those tables don't break his code — they just sit unread. The columns he DOES use (`Snippet.staffAnswer`, `Answer.isCorrect`, etc.) are still there and populated.

**One adjustment was needed:** `Snippet.staffAnswer` was `"Unknown"` everywhere after our seed (we use `staffTaxonId` instead). For the baseline matcher to grade anything correctly, we ran a one-shot to set `staffAnswer = staffTaxon.name` for the 19 staff-labelled clips. Now the baseline accepts answers like "common hermit crab", "whiting", "flounder", etc.

## ⚠️ Things that would break the baseline (don't do these)

- **Don't run `prisma db push` from the baseline directory.** Its schema is simpler than ours; Prisma would *drop* our extra tables. Catastrophic.
- **Don't run `npm run db:seed` from the baseline.** It reads from a "Fish Spotter Snips" folder that doesn't exist locally — it'd be a no-op, but if the folder existed it'd rewrite `Snippet.staffAnswer` from `metadata.json`.

## What each version does on the same data

| Action | :3000 (enhanced) | :3001 (baseline) |
|---|---|---|
| Type a species name | Alias-aware match + "Did you mean?" + reveal panel + life-list update | Exact-text match against `staffAnswer` |
| Click a clip card | Side-panel map + tracker toggle + ID guide button | Just the video + answer input |
| After submitting | Hero card with fun fact + points + change link | Community % bar only |
| Help me figure it out | ID Guide modal (3-5 questions, bbox prefill, OBIS-ranked candidates) | Doesn't exist |
| My taxa | Life-list Pokédex at `/me/taxa` | Doesn't exist |
| Taxon pages | `/taxon/[id]` with description + clips + aliases | Doesn't exist |
| Sign-in / sign-up | NextAuth credentials (same flow) | Same |

## Switching between them

Both share the user table. Sign in on either; sessions are port-scoped (different NEXTAUTH_URL = different cookie) so you have separate sessions on each port. That's fine for comparison.

## Tearing down the baseline

```bash
git worktree remove ../FishSpotter-mgtaco-baseline
git branch -d baseline-mgtaco
```

The worktree directory is removed; the branch lives in `.git/` until explicitly deleted.
