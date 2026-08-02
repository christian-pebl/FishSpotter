# Comment profanity masking — implementation plan

**Date:** 2026-08-02
**Branch:** `claude/comment-profanity-filter-bmhx5v`
**Status:** plan, not built. One open decision for Christian (§8).

---

## 1. What's being asked, and what already exists

**The ask:** strip swearing out of the comments section, or automatically turn
it into `****`.

**What's already there.** Comments shipped 2026-08-01 with a moderation layer
(`implementation/2026-08-01/user-comments-plan.md`). There is already a
~230-word `BLOCKLIST` in `src/lib/comments.ts`, merged from the MIT-licensed
LDNOOBW list with a marine-vocabulary exclude set. It already covers profanity
*and* slurs, and it is already matched word-level (so "bass", "assess",
"cockle", "Scunthorpe" stay clean — `comments.test.ts` pins that).

**What that list currently does is the whole gap.** A hit calls
`hitsBlocklist()` in `POST /api/comments` (route.ts:254) and the comment is
created with `hiddenAt` set — the entire comment goes dark pending a human at
`/admin/comments`. So today:

| Someone types | Today | What the ask wants |
|---|---|---|
| "that's a shit clip, can't see a thing" | **Whole comment hidden.** Author sees "held for review". Nobody else ever sees the useful half. Staff must manually unhide. | "that's a **** clip, can't see a thing" — live immediately |

So this is not "add a profanity filter" — it is **changing what a profanity hit
does**, from *hide the whole contribution and page a human* to *mask the word
and let the comment stand*. That is a better outcome on both sides: the spotter
keeps their contribution, the reader isn't shown the swear, and PEBL isn't
draining a review queue of people mildly grumbling about visibility.

---

## 2. The one thing this plan will not do: mask slurs

The existing `BLOCKLIST` is a single flat array. It contains `bollocks` and
`shit`. It also contains `paki`, `nigger`, `wetback`, `tranny`.

**Masking a slur is worse than hiding it.** `"get out of here you ****"` is
still a hostile comment aimed at someone, now rendered live and permanent with
a fig leaf over it. The word was never the harm; the aggression was. Auto-mask
is right for "this clip is shit" and actively wrong for a slur.

So the flat list splits into two severities:

| Tier | Contents | Behaviour |
|---|---|---|
| `mask` | Mild profanity, in the general register of British annoyance — `shit`, `shite`, `shitty`, `bollocks`, `bastard`, `arsehole`, `ass`, `asshole`, `bitch`, `crap`-class, `dick`, `prick`, `tosser`, `twat`, `wank`, `wanker`, `fuck` + inflections, `bullshit`, `motherfucker`, `piss`-class | **Masked, posted live.** No hold, no queue, no staff email. Comment appears immediately with `****` in place of the word. |
| `hold` | Everything else — every slur (racial, homophobic, ableist, antisemitic), all sexual/pornographic terms, `rape`/`paedophile`-class | **Unchanged from today.** `hiddenAt` set at creation, staff email, `/admin/comments` review. |

The `hold` tier keeps its current behaviour verbatim, so this change can only
ever *loosen* the mild end and never the severe end. Everything that is hidden
today stays hidden unless it is explicitly moved into `mask`.

Full tier assignment is authored in the diff, reviewed as a diff, and defended
by tests (§6). The default for an unclassified word is `hold` — a word must be
*deliberately* placed in `mask` to be masked, so a future list refresh that adds
unknown terms fails safe.

---

## 3. Where the masking happens: at the serialisation door, not at write

Two options, and the choice matters more than it looks:

**(A) Mask on write** — `body` is stored already masked, original discarded.
**(B) Store the original, mask in `toPublicComment()`.** ← **recommended**

Pick B, for four reasons:

1. **`toPublicComment` is already THE single serialisation door** (INV-2 in the
   2026-08-01 plan — every field named explicitly, a Prisma row is never
   spread). It is the one function every public payload passes through. Masking
   there means a future route cannot accidentally serve an unmasked body, in
   exactly the way `adminNote` cannot leak today. Confirmed by grep: the only
   two callers of `toPublicComment`/`threadShape` are both in
   `src/app/api/comments/route.ts`; `/admin/comments/page.tsx` builds its own
   admin payload from `r.body` directly and is *supposed* to see originals.
2. **Staff must see what was actually typed.** Moderation, repeat-offender
   patterns, and any police/safeguarding request all need the original. Under
   (A) the admin inbox and the staff notification email would show `****` and
   be useless for judging severity.
3. **No data migration, and the rules stay tunable.** Existing comments are
   masked the moment the code ships. If a word turns out to be a bad call, one
   line moves it and every past comment re-renders correctly. Under (A) a
   mis-tiered word is baked into the row forever.
4. **The tier can be re-judged.** A comment whose masked word sits next to
   genuine hostility can still be reported → auto-hidden → removed. Masking
   never removes a downstream option.

The cost of B is that the raw word sits in Postgres. That is already true today
(held comments store their original body verbatim), it is covered by the same
legal basis as the rest of moderation, and RLS already blocks the PostgREST
path on `Comment`.

---

## 4. The masking function

New export in `src/lib/comments.ts`, sitting next to `hitsBlocklist`:

```ts
/** Words masked to asterisks in public payloads. Everything else HOLDS. */
const MASK_SET: ReadonlySet<string>;   // tier `mask` from §2
const HOLD_SET: ReadonlySet<string>;   // tier `hold` — the current hold behaviour

/** Replaces every mask-tier word with asterisks. Returns the body unchanged if clean. */
export function maskProfanity(body: string): string;

/** Now only returns a hit for HOLD-tier words. Mask-tier words no longer hide a comment. */
export function hitsBlocklist(body: string): string | null;
```

Behaviour decisions, each deliberate:

- **Same-length asterisks.** `shit` → `****`, `bollocks` → `********`. Keeps
  line lengths and rhythm intact so a masked sentence still scans, and it reads
  as a redaction rather than a typo. (First-letter-kept — `s***` — was
  considered and rejected: it is *more* legible as profanity, not less, which
  defeats the point.)
- **Word-level tokenisation, same as `hitsBlocklist`.** This is the
  Scunthorpe guard and it is non-negotiable on a marine app. `bass`, `assess`,
  `cockle`, `mussel`, `shrimping`, `Scunthorpe` must never be touched. Reuse
  the existing `/[a-z']+/g` tokenising approach, but the masker must
  reconstruct the string rather than tokenise-and-rejoin, so punctuation,
  capitalisation and whitespace of the surrounding text survive exactly.
  Implementation: a single regex pass with word boundaries over the mask set,
  case-insensitive, replacing with `"*".repeat(match.length)`.
- **Modest suffix handling.** `fucking`, `fucked`, `shitty` are listed
  explicitly as their own entries rather than stemmed. Stemming is where
  Scunthorpe-class bugs come from.
- **No leetspeak / spacing arms race** — consistent with the existing
  `BLOCKLIST` doc comment. `sh1t` and `s h i t` pass through. This is the right
  call: an evasion regex on a marine app generates false positives on real
  vocabulary faster than it catches evaders, and the Report → auto-hide → admin
  path is the actual backstop for someone determined to be offensive. Worth
  saying out loud in the doc comment so nobody "fixes" it later.
- **`suggestedName` is masked too.** It is serialised on the same door and a
  species-suggestion field is an obvious place to type something rude.

Then in `toPublicComment()`:

```ts
body: viewer.isAdmin ? row.body : maskProfanity(row.body),
suggestedName: row.suggestedName && (viewer.isAdmin ? … : maskProfanity(…)),
```

Admins see the original (they moderate). **Authors see their own comment
masked, same as everyone else** — deliberately. If the author sees their own
word intact they'll assume it published intact; showing them the mask is the
whole feedback signal, and it costs nothing because they know what they typed.

Optionally add `wasMasked: boolean` to `PublicComment` so the UI can render a
one-line note on your own comment ("We tidied a word") — see §5.

---

## 5. UI surface

Deliberately small. The feature works with zero UI change; these are the two
touches worth having.

| File | Change |
|---|---|
| `src/components/idflow/CommentBox.tsx` | The `done` state currently branches on `held`. Add a third line for the masked-but-posted case: *"Posted. We've tidied up a word or two."* Needs `masked` on the POST response alongside the existing `held`. |
| `src/components/idflow/CommentThread.tsx` | Optional: on your own comment (`isMine`) where `wasMasked`, a small muted note. Skip if it clutters the 390px card — the composer message already carries the signal. |
| `src/app/admin/comments/CommentInbox.tsx` | Optional: a small "shown masked publicly" chip on rows whose original body has a mask-tier hit, so staff aren't confused about why a live comment contains a swear. |

No client-side pre-warning while typing. It teaches evasion, adds the wordlist
to the client bundle (where anyone can read the tier assignments), and the
post-hoc message is enough.

**No copy change to the guidelines/placeholder is strictly required**, but if
one is wanted: *"Keep it civil — we'll tidy the odd swear, but abuse gets
removed."* That is honest about both tiers.

---

## 6. Tests (`src/lib/comments.test.ts`)

The existing suite is the safety net; extend it rather than replacing anything.

New `describe("maskProfanity")`:

1. Masks a mask-tier word, preserving length: `"this is shit"` → `"this is ****"`.
2. Case-insensitive, and the rest of the sentence is untouched:
   `"THIS IS SHIT, mate."` → `"THIS IS ****, mate."`.
3. Punctuation and newlines survive: `"shit! really?"` → `"****! really?"`.
4. Multiple hits in one body all masked.
5. **The Scunthorpe block, re-run against the masker** — reuse the existing
   false-positive fixture list verbatim (`bass`, `assess`, `cockle`,
   `Scunthorpe`, `shrimping`, the marine-anatomy set) and assert
   `maskProfanity(body) === body` for every one. This is the test that matters
   most; a masking regression here is visible garbage on the live site.
6. Clean body returns the identical string (reference equality is fine).

Changes to `describe("hitsBlocklist")`:

7. **Mask-tier words no longer hold**: `hitsBlocklist("this is shit")` → `null`
   (was `"shit"`). Existing assertions at test.ts:180-181 and :238 change —
   that is the intended behaviour change, not a break.
8. **Hold-tier words still hold**: the slur assertions at :231-232 stay
   green, untouched. Add an explicit test asserting no slur appears in
   `MASK_SET` — iterate the mask tier against a hardcoded list of the slurs in
   the file and assert disjoint. This is the guardrail for §2 and stops a
   future list refresh from quietly promoting a slur into `mask`.

Changes to `describe("toPublicComment")`:

9. A non-admin viewer receives a masked `body`; an admin viewer receives the
   original. Same for `suggestedName`.
10. The existing INV-2 leak guard (:393-394 — no `hiddenReason`/`hiddenBy` in
    the payload) is unaffected and must stay green.

`CommentThread.test.tsx` needs no change unless the `wasMasked` note ships.

---

## 7. Files touched

| File | Change | Size |
|---|---|---|
| `src/lib/comments.ts` | Split `BLOCKLIST` into `MASK_SET` + `HOLD_SET`; add `maskProfanity()`; apply it in `toPublicComment()`; rewrite the tier doc comment | ~80 lines, the bulk of the work |
| `src/lib/comments.test.ts` | ~10 new tests, 3 existing assertions inverted | ~90 lines |
| `src/app/api/comments/route.ts` | Return `masked: boolean` on POST alongside `held` | ~4 lines |
| `src/components/idflow/CommentBox.tsx` | Third `done`-state message | ~6 lines |
| `src/app/admin/comments/CommentInbox.tsx` | Optional "masked publicly" chip | ~8 lines |
| `implementation/2026-08-02/…` | This doc | — |

**No schema change. No migration. No `prisma db push`, so no
`npm run db:enable-rls` step.** Masking is computed at read time, so it applies
retroactively to every comment already in the database the moment it deploys.

Pre-push gate, per CLAUDE.md conventions:
`npx tsc --noEmit && npm test && npm run lint && npm run lint:tokens`.

---

## 8. Open decision for Christian

**Where the mask/hold line sits.** The tiering in §2 is my recommendation, not
a fact. The judgement call is `fuck` and its inflections: it is the most common
English intensifier and almost always ordinary frustration ("can't see a
fucking thing in this one"), which argues for `mask`. But FishSpotter is 13+
and public, which argues for `hold`. I have put it in `mask` on the grounds
that holding it would send a steady trickle of harmless comments to a review
queue that then has to unhide them by hand — the failure mode the whole feature
exists to fix. Moving it to `hold` is a one-line change either way.

Two secondary calls, both cheap to flip:

- **Does the author see their own comment masked?** Recommended yes (§4).
- **Same-length asterisks vs a fixed `****`?** Recommended same-length.

Everything else in this plan is a mechanical consequence of §2 and §3.

---

## 9. What this deliberately does not do

- **No evasion handling** (`sh1t`, `s h i t`). Stated as a non-goal, not an
  oversight — see §4. The Report → auto-hide → admin path is the backstop.
- **No multi-word phrase matching.** Same reasoning as the existing list: the
  matcher is single-word by design, and phrase matching (word order,
  punctuation) is a different, harder problem.
- **No moderation API / hate-speech classifier.** Still the natural next step
  for the categories a static list can't cover, still needs a vendor and cost
  decision that is Christian's to make.
- **No edit-your-own-comment flow.** Unchanged from the 2026-08-01 plan.
- **No change to the report, auto-hide, or admin removal paths.** They are
  content-agnostic and remain the real backstop.
