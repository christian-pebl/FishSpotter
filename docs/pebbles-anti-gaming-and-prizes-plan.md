# FishSpotter: Anti-Gaming Currency Model + Prize Triggers (Implementation Plan)

_Drafted 2026-07-17. Two plans: (1) make the Pebbles economy ungameable; (2) trigger + timing design for the five agreed prizes. Grounded in the current code (`src/lib/pebbles.ts`, `src/lib/consensus.ts`, `src/app/api/answers/route.ts`, `prisma/schema.prisma`)._

**Decision (2026-07-17):** crowd consensus stays the sole authority for what a clip is. No expert "gold answer" labelling: it would put recurring manual annotation work back on PEBL, the exact cost the crowd loop exists to avoid. Anti-Sybil is therefore done with a crowd-internal, seeded trust layer that needs zero per-clip labelling.

## The key finding

The economy has already moved to **pure crowd authority**: a clip's truth is whatever `CONSENSUS_THRESHOLD_USERS = 3` distinct spotters converge on, unweighted, and `staffAnswer` (the old expert reference) is retired from scoring. That design is what the Sybil / self-consensus attack exploits: a ring of 3+ coordinated fake accounts can mint their own consensus on a rare species, all get vindicated, all build "Current" streaks, and farm the rarity multiplier. Blind submission does not stop out-of-band collusion.

With real prizes now attached (guidebook up to a ~£1,500 SubCam), the scoring model becomes the prize-budget control. If Pebbles are farmable, the prizes are farmable. So the fix must come before prizes are advertised. But the fix must not reintroduce manual labelling: the anchor is crowd-internal (seeded trust), not an expert key.

**What is already good (keep):** 5-Pebble floor, never zero (`PEBBLE_BASE_SIGHTING`); no penalties anywhere; reliability streak (`currentMultiplier`, cap 2.5x); blind submission (histogram gated until you answer); re-guess cannot re-farm (award locked); rate limit 200/hr; OBIS-derived rarity (external, unfakeable); `isContested` detection already flags clips for expert review.

**The one real hole:** truth = unweighted crowd of 3, and prizes would sit on raw Pebble totals (which include the farmable floor).

---

## Plan 1: Make the currency ungameable (no labelling)

**Principle.** Keep the crowd as the authority for what a clip is (mission-aligned, already built, do not revert). Add a **hidden, crowd-seeded Trust layer** that only ever gates *upside* (the rare-species jackpot, prize eligibility, consensus weight). Trust never removes Pebbles and never penalises, honouring "even a guess earns a little, never punish." The floor stays ungated so newcomers always progress. No expert answer key, no per-clip grading.

### Phase 1: Seeded trust backbone + prize gate (MUST ship before advertising any prize)

1. **Seed trust from a few known-real accounts.** Add `isTrustSeed Boolean @default(false)` on `User` and flag a handful of genuine people (Christian, Anjali, a couple of long-standing real users). This is a one-time action, not ongoing work, and it is not labelling clips. Seeds just play the app normally like any user; that is enough to bootstrap.
2. **Trust score (hidden reputation), computed automatically.** New fields on `User`: `trustScore Float @default(0)`, `trustUpdatedAt DateTime?`. Trust is earned by matching consensuses that already carry trusted weight, propagating outward from the seeds (a light EigenTrust / web-of-trust). Computed in the existing consensus cron, smoothed so a lucky short run does not max out, lightly time-decayed. A sock-puppet ring only ever agrees with itself, never with the trusted network, so its mutual agreement earns no trust.
3. **Prize-eligibility gate.** A user is prize-eligible only with: `emailVerified` set + `trustScore` above a bar + account activity spread over a time window (not a burst). `emailVerified` and `createdAt` already exist. This is what makes the prize ladder Sybil-safe: sock-puppets can farm floor Pebbles but cannot clear the trust + identity + track-record gate to redeem anything.

### Phase 2: Close the in-economy farm (not just prize redemption)

4. **Trust-weight the consensus payout.** Keep the public consensus label as-is (raw count of 3 can still set a public label), but require the winning camp to clear a *trust-weighted* bar before the big `consensusPayout` and the rarity multiplier fire. A camp of zero-trust sock-puppets sums to ~0 weight and triggers no payout, even if it forms a public label. Implementation: pass a per-user trust weight into `rescoreConsensus` and gate the payout/rarity path on the weighted sum.
5. **Cap the rarity multiplier for low-trust users.** The rare-species multiplier (up to 5x for legendary) is the most lucrative farm target. Clamp it, and gate rare-species pokedex unlocks, for users below a trust bar. Newcomers still earn the floor and base consensus, just not the amplified rare-species jackpot until they have a track record.

### Phase 3: Calibration + collusion signals

6. **Confidence + coarse taxonomy (Anjali's asks).** Let users answer at a coarser level ("wrasse", "it's a fish") and mark sure / not-sure, so honest calibration beats confident spam and "not sure" becomes a scoreable, unpunished move. Pure crowd-scored (a coarse answer matches the coarse consensus), still no expert key.
7. **Collusion-cluster detection (advisory, never auto-punish).** Flag account clusters that repeatedly co-occur only with each other and never with the trusted population; exclude them from prize eligibility. Consistent with "never penalise": it withholds prize upside, it does not remove Pebbles.

**Cold-start note.** Early on, few clips have a trusted answer in the camp. This resolves itself: seeds playing normally spreads trust outward quickly, and the floor keeps everyone earning meanwhile. No manual acceleration needed.

**Minimal fallback (if even Phase 1 is too much build):** skip the trust system; gate *prizes* on verified email + account age + a high sustained-contribution bar, and gate the rarity jackpot behind account maturity. This protects the prize budget (the real money) but leaves the leaderboard and ML labels somewhat farmable. Seeded trust is preferred because it also protects data quality at near-zero ongoing cost.

**Sequencing:** Phase 1 is the gate and must precede any advertised prize. Phase 2 hardens the economy itself. Phase 3 is quality-of-life + defence-in-depth.

---

## Plan 2: The five prizes: triggers and timing

**The golden rule linking both plans:** every prize above the cosmetic layer gates on **Trust + verified identity + sustained activity, never on raw Pebble totals.** Raw Pebbles (with the floor) drive the fun and the leaderboard; trust-vindicated contribution drives prizes. That single decision is what makes the ladder Sybil-safe.

The five (Car-Y-Mor voucher and farm visit removed), plus the earned verifier role.

| # | Prize | Layer | Trigger | Cadence | Eligibility gate | Cost control |
|---|-------|-------|---------|---------|------------------|--------------|
| 1 | Pokedex finishes + site badges | Everyday | Auto on rare-species unlock / N vindicated IDs at a site | Instant | Inherits trust-weighted consensus | Zero, infinite scale |
| 2 | Contributor credit (dataset / paper, DOI) | Milestone | Trust + N vindicated IDs, opt-in to be named | Per dataset / paper release | Trust + verified + naming opt-in | Near zero |
| 3 | Featured Spotter of the Month | Milestone | Top of a monthly *trust-weighted* board | Monthly | Verified + `leaderboardOptIn` + not flagged | Zero, is marketing |
| 4 | Marine ID guidebook | Milestone | Milestone: trust bar + N vindicated IDs, once per person | On qualifying, batched fulfilment | Full Sybil gate | ~£15 x qualifiers, one each |
| 5 | SubCam / GrowProbe | Grand | Qualify-then-lottery over the year | Annual | Strongest gate: verified + high trust + activity across >=K months | Exactly 1 unit/yr, refurb |
| + | Verifier / curator role | Earned | High trust + N vindicated IDs | On qualifying | Trust bar | Zero, feeds ML loop |

### Per-prize detail

1. **Pokedex finishes + site badges (everyday, automatic, free).** Award on achievement, not purchase, so farmers cannot buy them. A species card gets a holo finish when unlocked via an `epic`/`legendary` rarity consensus (tiers already exist in `pebbles.ts`); a site badge is earned at N vindicated IDs for a given `Snippet.site`. Presentational, leaning on the existing `UnlockedSpecies` model and `SpeciesCollection.tsx`. Because rare unlocks flow through trust-weighted consensus (Plan 1 Phase 2), a Sybil ring cannot mint rare holo cards. This is the daily-retention engine.

2. **Contributor credit in a PEBL dataset / methods paper (milestone, periodic, near-free).** Qualify on trust + a minimum of vindicated contributions, opt in to be named. Batched per real dataset release or paper, so it plugs straight into the citation-led go-to-market strategy. ICO Children's Code: `ageBracket` is stored; minors are credited by username only with guardian consent, or not named.

3. **Featured Spotter of the Month (recurring, monthly, free).** Rank a **monthly** board by trust-weighted vindicated contribution, not raw Pebbles, so it cannot be farmed. Automated shortlist + a manual sanity check before publishing to socials and the site. Store a `FeaturedSpotter` record (month, userId) to keep history and avoid picking the same person repeatedly. Gate: verified + `leaderboardOptIn` (both exist) + not in a flagged cluster. This is authentic marketing content, the lever the Business Brain says is unspent (~£83/yr marketing).

4. **Marine ID guidebook (milestone, threshold redemption, ~£10-20).** The first prize with real money, so it takes the full Sybil gate. Trigger on a genuine-contribution milestone (trust bar + N vindicated IDs + verified + activity spread), not a Pebble count. One claim per person, ever (or once/year). Bounded, forecastable cost: qualifiers x ~£15. Fulfil in batches.

5. **SubCam / GrowProbe (grand, rare, ~£1,500, qualify-then-lottery).** Do **not** make this a threshold anyone can reach; that is an open-ended £1,500 liability. Instead: anyone who clears a high genuine-contribution bar over the calendar year (verified + high trust + N vindicated IDs + active across >=K months) enters a public, auditable draw for one unit. Lottery is fairer to newcomers than top-of-leaderboard (which early users lock up), caps cost at exactly one unit/year, and is Sybil-resistant because every entrant must independently clear the trust gate. Use a refurbished / returned field unit to cut real cost, and pair the win with onboarding (a docs.pebl deployment guide + a short call) so the winner actually deploys it and becomes a footage contributor: this closes the loop back into the app. This is a deliberate, single-unit pilot of "an enthusiast gets a SubCam", adjacent to but not a commitment on the unresolved prosumer-SKU question.

**Verifier / curator role (earned, not redeemed).** High trust + N vindicated IDs unlocks the ability to review `isContested` clips (already detected in `pebbles.ts`) and cast a weighted tiebreak; reviewing earns Pebbles. It is the only reward that directly feeds the ML annotation loop (the moat priority) and turns top players into an expert-review layer, all without PEBL doing per-clip labelling.

### Cross-cutting

- **Schema for redemption:** one `PrizeClaim` model (`userId`, `prizeType`, `claimedAt`, `fulfilmentStatus`, `shippingDetails`), `@@unique([userId, prizeType])` to block double-claims; plus `PrizeDraw` (`year`, `prizeType`) and `PrizeDrawEntry` (`userId`, `drawId`, `qualifiedAt`) for the annual capstone.
- **Minors (ICO Children's Code):** physical prizes to 13-17s need guardian consent and careful PII handling; `ageBracket` + `leaderboardOptIn` already support the gating.
- **Never penalise:** no prize mechanic ever removes Pebbles or status. Gates only ever withhold upside.

---

## What to build first

1. Plan 1 Phase 1 (seed a few trusted accounts + auto Trust score + prize-eligibility gate). This is the gate; nothing with real money ships before it. No labelling.
2. Prizes 1 and 3 (Pokedex/site cosmetics, Featured Spotter). Near-free, on-mission, and prize 3 doubles as marketing.
3. Plan 1 Phase 2 (trust-weighted consensus + rarity cap), then prizes 2 and 4 (contributor credit, guidebook).
4. Plan 1 Phase 3 + prize 5 (annual SubCam/GrowProbe lottery) once trust data has accumulated over a full window.
