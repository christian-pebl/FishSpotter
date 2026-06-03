# Fish-class silhouette audit + Rung-3 design review

**Date:** 2026-06-03
**Method:** 5 parallel vision agents (each viewed the curated reference photo of its
group and judged shape-class + body-shape against the enums), cross-checked by a
Gemini 3.5 Flash teaching-quality sweep (`images:assess`, model pinned in
`.env.local`). Gemini covered 10/31 before the free-tier daily quota (~20 req/day)
was exhausted; its 10 reads agree with the agents, so agent vision is the system of
record for the remaining 21.
**Scope:** all 31 fish-type species (26 `fish`, 3 `flatfish`, 2 `scooter`).

---

## Headline

1. **Rung 1 (shape-class) is sound.** Every species is in the right gate. The only
   watch item is the **lesser-spotted catshark**: it reads as "shark" to a lay user
   but there is no `shark` gate, so it stays in `fish`. It is the single species
   that would justify adding a `shark` Rung-1 class later.
2. **Rung 2 (body-shape) is the problem.** 21 of 26 fish are tagged `fusiform`, so
   after picking "fish → torpedo" a user still faces ~21 candidates. Much of this is
   over-tagging: deep-bodied wrasses/bib and low bottom-dwelling gobies/blennies are
   not really torpedoes. Re-tagging (below) drops the bucket to ~13.
3. **A Rung 3 is justified and designed.** Even after re-tagging, the fusiform and
   gadoid clusters need a short trait chain. Per-bucket information-gain chains are
   specified below. They need ~6 small additions to the trait vocabulary.

---

## A. Silhouette re-tagging (Rung 2 `bodyShape`)

CHANGE rows only; everything else AGREED. "Lead" = first/primary value (the silhouette
the species should sort under).

| Species | Current `bodyShape` | Recommended | Why (from the photo) |
|---|---|---|---|
| Bib | fusiform, laterally-compressed | **laterally-compressed** (lead) | Deepest-bodied gadoid; hump-backed, slab-sided, copper bars. Not a torpedo. |
| Poor cod | fusiform | **fusiform, laterally-compressed** | Medium-deep; add lat-comp so it isn't lost among slim fusiforms. |
| Ballan wrasse | fusiform, laterally-compressed | **laterally-compressed** (lead) | Deep oval slab body, depth ≈ ⅓ length. |
| Corkwing wrasse | fusiform, laterally-compressed | **laterally-compressed** (drop fusiform) | Small compressed oval; classic deep small wrasse. |
| Cuckoo wrasse | fusiform | **fusiform, laterally-compressed** | Borderline; moderately deep. Keep both. |
| Common goby | fusiform | **elongated, fusiform** (lead elongated) | Slender low bottom-sitter, not a torpedo. |
| Rock goby | fusiform | **elongated, fusiform** (lead elongated) | Low elongate bottom-sitter (stockier but not torpedo). |
| Sand goby | fusiform | **elongated, fusiform** (lead elongated) | Translucent slender low body hugging sand. |
| Butterfish | elongated, laterally-compressed | **eel-like, laterally-compressed** (lead eel-like) | Long ribbon, single continuous dorsal — the eel-like end. |
| Shanny | laterally-compressed, elongated | **elongated, laterally-compressed** (reorder) | Blunt scaleless blenny, tapering elongate body. |
| Sprat | fusiform | **laterally-compressed** (judgment edge) | Herring keel + slab body; separates clupeid from true torpedoes. Flag for a maintainer call. |
| Conger eel | eel-like, elongated | **eel-like** (trim) | Pure snake silhouette; `elongated` only muddies Rung 2. |
| Dragonet | flat-dorsoventral, elongated | **flat-dorsoventral** (trim) | Scooter is a single silhouette; `elongated` redundant. |
| Spotted dragonet | flat-dorsoventral, elongated | **flat-dorsoventral** (trim) | Same as above. |

**Stay `fusiform` (true torpedoes):** Pollack, Saithe (both also `elongated`), Atlantic
cod, Goldsinny wrasse, Two-spotted goby, Long-spined sea scorpion (stout but fair),
horse mackerel, Atlantic mackerel, sea bass, thick-lipped mullet, red mullet, catshark.

**Net effect:** fusiform bucket 21 → ~13, and the gobies/blennies/butterfish move into
`elongated`/`eel-like` where they actually belong, so Rung 2 does real work instead of
dumping everyone into one tile.

### Vocabulary notes on shape
- **`eel-like` and `snake-like` are duplicate silhouettes.** Consolidate to `eel-like`;
  retire `snake-like` so the gate never shows two near-identical tiles.
- **`flat-dorsoventral` is overloaded.** Dragonets are genuinely flattened top-to-bottom;
  flatfish are laterally compressed *then lie on one flank*. Both currently carry
  `flat-dorsoventral`. Cosmetic only (flatfish + scooter skip Rung 2), but if the value
  ever surfaces in UI it will mislead. Leave as-is, noted.

---

## B. Photo-suitability flags (curation backlog, not blocking)

Confirmed poor / replace-when-convenient teaching references:

| Species | Issue | Gemini | Agent |
|---|---|---|---|
| Saithe | Beachcast on a measuring board (dead) | 40 poor, dead | dead, usable stopgap |
| Atlantic cod | Live but oblique, low-contrast, merges with seabed; barbel not visible | (quota) | marginal, replace |
| Atlantic mackerel | Dead fish on a boat-deck bucket lid, cluttered | 45 poor, dead (earlier) | dead, confirm + replace |
| Sprat | Dead on ice/snow; features legible | (quota) | dead, low priority |
| Goldsinny wrasse | Oblique angle | 55 poor | usable |
| Rock goby | Held in fingers, thumb obscures belly sucker | 55 poor | usable, not ideal |
| Cuckoo wrasse | **Shows MALE only** (blue phase); females plain orange — a learner shown only this will miss females | 88 ideal (photo is fine; the issue is single-sex coverage) | pair with a female image or label sex |

Verified GOOD (notable): **Flounder is a clean live fish, NOT the old seal-eating-flounder
photo.** Two-spotted goby 95/ideal. Plaice/Dab usable (caught but clean). All dragonet,
catshark, conger photos suitable.

Note: Gemini scored both dragonet photos 50–55 (poor) where the agent called them
excellent for scooter posture — the disagreement is Gemini penalizing the busy seabed
background, not the specimen. Agent view preferred here.

---

## C. Rung-3 design (per body-shape bucket)

Each chain is ordered by information gain: the first question peels the cluster out of
the wider pool, later questions split within it. All terminate in 2–4 questions.

### Gadoids (deep + slim fusiform: Pollack, Saithe, Bib, Poor cod, Cod)
1. **Chin barbel?** (`features: barbels`) — lifts gadoids out of the fusiform pool wholesale.
2. **Body depth** (NEW `bodyDepth: deep/medium/slender`) — isolates Bib (deep).
3. **Pattern** (`coloration: banded` vs `mottled`) — Bib = copper bars, Cod = mottled.
4. **Lateral line** (NEW `lateralLine: pale-straight/dark-curved/indistinct`) — Saithe
   (pale straight) vs Pollack (dark curved + jutting lower jaw).

### Wrasses (Ballan, Cuckoo, Corkwing, Goldsinny)
1. **Body depth** — deep (Ballan/Corkwing/Cuckoo) vs slender (Goldsinny).
2. **Colour/pattern** — spotted+large = Ballan; iridescent blue head stripes = Cuckoo ♂;
   fine horizontal stripes, small = Corkwing.
3. **Caudal-peduncle spot?** (NEW `markings: caudal-spot`) — present in Corkwing + Goldsinny.

### Gobies / small benthic (the strongest argument for re-tagging out of fusiform)
1. **Body form** — `eel-like` isolates Butterfish; `fusiform` = Two-spotted goby (+ scorpion).
2. **Head profile** — long pointed snout = 15-spined stickleback; big spiny head = sea scorpion.
3. **Pelvic sucker + dorsal layout** (NEW `features: pelvic-sucker`, `finShape: split-dorsal`)
   — two dorsals + belly sucker = goby; one long dorsal, no sucker = Shanny.
4. **Markings/colour** — Rock goby = pale first-dorsal margin; sand vs common goby is a
   known hard pair (terminal "small Pomatoschistus goby" is acceptable).
- Butterfish clincher: **row of black white-ringed eye-spots along the dorsal base**
  (NEW `markings: dorsal-eye-spot-row`, or reuse `dorsal-spots`).

### Pelagic + mullets (the core of the over-stuffed bucket)
1. **Two chin barbels?** → Red mullet (terminal).
2. **Wavy dorsal bars + finlet row?** (`coloration: banded` + NEW `finShape: finlets`) → Atlantic mackerel.
3. **Bony lateral-line scutes + big eye?** (NEW `features: lateral-scutes`) → Horse mackerel.
4. **Two separate dorsals + head/lip:** pointed head/large jaw = Sea bass; blunt head +
   thick upper lip (`features: fleshy-lips`) = Thick-lipped mullet.
5. **Slender silver residue:** continuous silver midline stripe = Sand smelt; keeled
   herring belly = Sprat (best pre-routed to `laterally-compressed` so it never reaches here).

### Flatfish (Plaice / Dab / Flounder)
1. **Bright orange/red spots?** → **Plaice**.
2. **Lateral line strongly arched over the pectoral?** → **Dab**.
3. **Bony tubercles along the fin bases + lateral line, drab/mottled?** → **Flounder**.
- DiagnosticMark targets: Plaice → orange spot cluster; Dab → arched lateral line;
  Flounder → tubercle row at a dorsal-fin base.

---

## D. Trait-vocabulary additions required for Rung 3

Building Rung 3 needs these `traits.ts` enum additions (and matching tags in
`species-traits.json`). Ordered by value:

| # | Add | To | Splits |
|---|---|---|---|
| 1 | `bodyDepth: deep \| medium \| slender` (NEW trait) | new key | Deep gadoids/wrasses vs slim |
| 2 | `lateralLine: pale-straight \| dark-curved \| arched-over-pectoral \| indistinct` (NEW trait) | new key | Saithe/Pollack/Cod + Dab |
| 3 | `pelvic-sucker` | `features` | Goby vs blenny (the gobiid synapomorphy) |
| 4 | `lateral-scutes` | `features` | Horse mackerel (Carangidae) |
| 5 | `finlets` | `finShape` | Mackerel/tuna (Scombridae) |
| 6 | `caudal-spot` | `markings` | Corkwing, Goldsinny, Two-spotted goby |
| (opt) | `dorsal-eye-spot-row` | `markings` | Butterfish (or reuse `dorsal-spots`) |

`barbels`, `banded`, `mottled`, `fleshy-lips`, `split-dorsal`, `spotted`,
`striped-horizontal` already exist and do real work — no change needed.

The information-gain picker (`src/lib/idguide/next-trait.ts`) already chooses the
best next question automatically, so once the species are tagged with these traits the
Rung-3 chains above emerge from the existing engine — no per-bucket hand-coding needed.
The work is: (1) extend `traits.ts` enums, (2) re-tag `species-traits.json`, (3) surface
Rung 3 in the flow after Rung 2.

---

## IMPLEMENTED (3 Jun 2026)

Steps 1–3 shipped (Rung 3 itself was already wired — `CandidateStrip` runs the
`nextBestTrait` adaptive loop; it just lacked discriminating data).

- **Code** (`traits.ts`, `narrow.ts`, `trait-questions.ts` + their tests):
  retired the duplicate `snake-like` body shape; added two new scored traits
  `bodyDepth` (deep/medium/slender) and `lateralLine`
  (pale-straight/dark-curved/arched-over-pectoral/indistinct); added
  `caudal-spot` (markings), `finlets` (finShape), `pelvic-sucker` +
  `lateral-scutes` (features). All wired into `TRAIT_KEYS` + `ALLOWED_VALUES`
  and given curated yes/no question copy (the coverage test enforces this).
- **Data** (`species-traits.json`, 29 fish entries): re-tagged `bodyShape`
  per section A; tagged `bodyDepth` across the fusiform/elongated pool;
  `lateralLine` on Saithe/Pollack/Cod/Dab; `pelvic-sucker` on the 4 gobies;
  `lateral-scutes` on horse mackerel; `finlets` on mackerel; `caudal-spot` on
  Corkwing/Goldsinny/Two-spotted goby. (Gadoids + red mullet already carried
  `barbels`.)
- **Effect (verified):** the fusiform fish bucket drops **21 → 17** (the four
  unambiguously deep fish — Bib, Ballan, Corkwing, Sprat — leave entirely;
  gobies + Cuckoo stay dual-tagged so a beginner can't dead-end). The Rung-3
  picker now yields a high-gain chain on that bucket: `bodyDepth` (9/8 split,
  gain 1.00) → coloration → size → markings.
- **Validation:** `tsc` clean, 205/205 tests pass, `lint:tokens` exit 0,
  production `build` clean. (Live feed not driveable by the eval harness — same
  IntersectionObserver limitation noted for the Rung-2 work; static gates +
  on-device check are the verification path.)
- **Not done at first:** the curation backlog (section B) — see below, now
  actioned. The `shark` Rung-1 gate (catshark) was left as a noted future
  option, not built.

## Curation backlog ACTIONED (3 Jun 2026, paid Gemini)

With the Gemini key on a paid tier (daily-quota wall gone), ran
`images:assess --species` over every flagged species plus a deeper direct iNat
sweep (top-12 by votes) for the ones with no good cached photo. Gemini-verified,
licence-compliant swaps pinned as `curated` overrides in `species-images.json`,
then `db:refresh-images --species` + demoted the stale curated rows
(non-destructively — `curated=false`, not deleted) so the new photo leads with
exactly one curated row:

| Species | Was | Now | Source / licence |
|---|---|---|---|
| Saithe | 40 poor (dead beachcast) | **88 ideal** | Wikimedia, Tino Strauss, CC BY-SA — straight pale lateral line crisp (matches the new `lateralLine` tag) |
| Goldsinny wrasse | 55 poor (tail cropped) | **90 ideal** | iNat, mnolito, CC BY-NC — black caudal spot clear (matches new `caudal-spot` tag) |
| Rock goby | 72 usable (hand-held) | **88 ideal** | Wikimedia, Etrusko25, Public Domain — diagnostic dorsal band |
| Atlantic cod | 55 poor (oblique) | **72 usable** | iNat, Hunter Stevens, CC BY-NC — live juvenile, lateral |
| Atlantic mackerel | 45 poor (dead on boat) | **55 poor** | Wikimedia, Hans Hillewaert, CC BY-SA — clean studio; clarity upgrade only |
| Sprat | 50 poor (dead) | unchanged | every top-voted iNat/Wikimedia photo is dead — no live photo exists to pin |

A **full Gemini baseline over all 31 fish leads** then caught 3 more dead-specimen
leads the visual agents had passed as "usable", plus a dead-flagged horse mackerel.
A second deep iNat sweep found clear live winners for all but the two food-fish:

| Species | Was | Now | Source / licence |
|---|---|---|---|
| Atlantic horse mackerel | 65 usable (dead) | **92 ideal** | iNat, whodden, CC BY-NC — "prominent lateral-line scutes" (matches new `lateral-scutes` tag) |
| Dab | 50 poor (dead) | **90 ideal** | iNat, Alex Shure, CC BY-NC — top-down eyed side, curved lateral line clear |
| European sea bass | 45 poor (dead) | **78 usable** | iNat, Alison Mayor, CC BY-NC — live lateral in habitat |
| Butterfish | 45 poor (dead) | **75 usable** | iNat, Calum McLennan, CC BY-NC — live lateral, diagnostic dorsal eye-spot row |

- **Net fish-catalogue quality:** only **Atlantic mackerel (55)** and **Sprat (45)**
  remain poor — both food-fish with NO live lateral photo on iNaturalist or
  Wikimedia (near-universally photographed dead/caught); the pins are the cleanest
  available. Everything else is now usable/ideal. Cuckoo wrasse pin is good but
  **male-only** (blue phase) — a gallery coverage gap, not a quality problem.
- **Dormant marks → RE-AUTHORED:** the swaps demoted old photos that carried draft
  DiagnosticMarks (Rock goby, sea bass, butterfish, horse mackerel — 3 each = 12).
  Rather than leave those four species with a great photo but no teaching rings, I
  re-authored **12 fresh draft marks** read off the NEW curated photos via
  `scripts/reauthor-upgraded-fish-marks.ts` (sibling of `seed-fish-marks.ts`;
  idempotent against the curated photo). Verified all 4 render their 3 marks on the
  curated lead. Coords are first-draft (tune in `/admin/species/[name]`); each
  species' marks target its real diagnostic — Rock goby's pale dorsal band, sea
  bass's spiny dorsal + gill-cover spine, butterfish's dorsal eye-spot row, horse
  mackerel's lateral-line scutes. The old dormant marks remain on the now-non-curated
  rows (harmless — the API strips marks from non-curated photos).
- **Model:** `GEMINI_MODEL=gemini-3.5-flash` (latest), pinned in `.env.local`.
  Quota now paid (the free-tier ~20/day wall is gone), which is what made the
  full baseline + deep sweeps possible.

## Recommended order of work (original plan)
1. **Re-tag `bodyShape`** per section A (data-only, immediate de-clutter of Rung 2).
2. **Consolidate `eel-like`/`snake-like`** (retire the duplicate).
3. **Add the 6 trait values** (section D) to `traits.ts` + tag the species.
4. **Wire Rung 3** into the flow (FeedCard → after Rung 2, drive `next-trait.ts`).
5. **Curation backlog** (section B): replace the dead Saithe/mackerel/sprat refs,
   add a female Cuckoo wrasse, swap the oblique cod — via the `images:assess` →
   `species-images.json` override → `db:refresh-images` loop.
