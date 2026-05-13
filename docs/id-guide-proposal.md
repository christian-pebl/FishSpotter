# ID Guide — Design Proposal

> **What:** A guided "I don't know what this is" flow that walks the user through a few questions about what they see (shape, movement, screen position) and cross-references the answers with what's known to live at that location, depth, and time of year — narrowing down to a short list of likely species.

> **Why:** Free-text typing is brutal for beginners. A guided funnel lowers the activation cliff dramatically and turns "I have no idea" into a teaching moment instead of a dead end. Pattern proven at scale by [Merlin Bird ID's Step-by-Step](https://merlin.allaboutbirds.org/) (used by ~2M people/month).

> **Status:** Design only — no code yet. Ready to scope into a phase once approved.

---

## 1. The user moment we're solving

A beginner watches a clip and sees something silvery moving along the seabed. They don't know it's a sand goby. Today they:
- Type "small fish" → wrong
- Try "sandfish" → wrong
- Get a fuzzy suggestion that's still not right
- Give up

The ID guide replaces this with a 30-second guided flow:

> What kind? **Fish** → How does it move? **Darting along the seabed** → Where? **On the bottom** → What colour? **Sandy/brown** → Result: Sand goby (87%), Dragonet (8%), Pouting (5%) — tap to confirm.

User learns *what to look for* in the process, not just the answer.

---

## 2. Three reference patterns we're stealing from

| App | Pattern we use | Pattern we don't |
|---|---|---|
| **[Merlin Bird ID](https://merlin.allaboutbirds.org/)** | 5-question funnel (location, size, colour, behaviour, time of year); probabilistic ranking, not strict dichotomy | Their static dataset assumption — we have *live* deployment data and an evolving species list |
| **[iNaturalist Seek](https://www.inaturalist.org/pages/seek_app)** | Image-first AI with "research-grade" community confirmation | Pure-AI: too opaque for our user; we want the user to learn through answering questions |
| **WoRMS / OBIS / GBIF** | Taxonomic spine + occurrence-based filtering ("seen here in May at 20m") | The data scientists' UX — too dense for our audience |

The North Devon coastal user wants: **"help me name what I just saw without making me feel stupid."** That's the design north star.

---

## 3. The five questions (proposed)

Question order is calibrated to maximise information gain per tap. Each step shows fewer options than the last as the funnel narrows.

### Q1 — What kind of creature?
Coarse functional groups, big tap targets. **Pre-fill from clip metadata when we have it** (the AI's `functional_group` tag). User can override.

```
🐟 Fish        🦀 Crab/Lobster
🪼 Jellyfish   🐚 Shellfish/Whelk
⭐ Starfish    🦑 Squid
👻 Not sure / Other
```

### Q2 — How does it move?
Behaviour is high-information. We can default this from the bbox track (we have the path) — if the bbox ranges across the full frame the creature is "swimming"; if it stays in a tight area it's "stationary".

```
↗️ Swimming smoothly
⚡ Darting in bursts
🌬️ Drifting passively
🐌 Crawling on seabed
🛌 Sitting still
🕳️ Half-buried / hidden
```

### Q3 — Where in the frame?
We can pre-fill from the bbox y-coordinate (mean across the track):
- y_norm > 0.7 → "On the seabed"
- y_norm < 0.3 → "Near the surface"
- else → "Mid-water"

```
🛟 Near the surface
🌊 Mid-water
🪨 On the seabed
```

### Q4 — Body shape (varies by Q1)
The options change based on Q1. For "Fish":

```
🐟 Streamlined / torpedo
🟫 Flat (lying on side)
🐍 Long & eel-like
🐡 Round / globular
```

For "Crab":
```
🦀 Squarish (typical crab)
🐚 Hidden in shell (hermit)
🕷️ Long-legged & spindly
```

### Q5 — Colour and markings (optional)

```
🥈 Silvery / metallic
🟫 Sandy / brown
🟥 Red / orange
🟤 Mottled / camouflaged
⚫ Dark / black
🦓 Striped
🟢 Translucent / transparent
```

After 3–5 questions, show the **top 5 candidates** as cards with hero photo + name + "see why" expand button. User taps to confirm.

---

## 4. The data layer — three concentric circles of filtering

```
        ╭─────────────────────────────╮
        │   ALL TAXA (58 in our DB)   │
        │  ╭───────────────────────╮  │
        │  │  Match user answers   │  │
        │  │  (~5–10 candidates)   │  │
        │  │  ╭─────────────────╮  │  │
        │  │  │ Recorded near   │  │  │
        │  │  │ this lat/lon at │  │  │
        │  │  │ this depth & mo │  │  │
        │  │  ╰─────────────────╯  │  │
        │  ╰───────────────────────╯  │
        ╰─────────────────────────────╯
```

### Inner circle — local + verified
Start with our `Taxon` table (the 58 we already have, all confirmed for North Devon by PEBL).

### Middle circle — attribute filtering
Filter taxa by user's answers. Requires we tag each taxon with attributes:
- `functionalGroup` (fish/crab/etc.)
- `bodyShape` (streamlined/flat/elongated/...)
- `typicalLocomotion` (swimming/drifting/crawling/...)
- `screenZone` (seabed/midwater/surface)
- `colorTags` (silvery, sandy, red, ...)

Implemented as a flexible `TaxonAttribute` table: `(taxonId, key, value)`. Additive, extensible — any future question doesn't need a schema change.

### Outer circle — biogeographic plausibility
**This is the killer feature**: a goby that lives in the Mediterranean shouldn't be a candidate at Bideford Bay. We use [OBIS](https://obis.org/)'s checklist endpoint to get the species occurring at our location, depth, and month, and use that as a soft prior.

---

## 5. External data sources — what each gives us

| Source | What | API | Use for | Cost |
|---|---|---|---|---|
| **[OBIS](https://obis.org/)** (Ocean Biodiversity Information System) | 100M+ marine species occurrence records, 180k species, surface to abyss | `api.obis.org/v3/checklist?geometry=POLYGON(...)&depthfrom=15&depthto=25&startdate=2024-06-01&enddate=2024-08-31` | "What's been recorded at Bideford Bay at 20m in summer?" — biogeographic prior | Free, unlimited |
| **[GBIF](https://www.gbif.org/)** (Global Biodiversity Information Facility) | 1.6B+ occurrence records (terrestrial + marine) | `api.gbif.org/v1/occurrence/search?decimalLatitude=51.06&decimalLongitude=-4.36&depth=15,25&month=6` | Cross-check OBIS, fill in gaps for non-marine context | Free, unlimited |
| **[WoRMS](https://www.marinespecies.org/)** (World Register of Marine Species) | The taxonomic spine for marine biology — accepted names, vernaculars, hierarchy | `marinespecies.org/rest/AphiaRecordsByName/Pagurus%20bernhardus` | Resolve our species names to authoritative taxonomy + pull vernacular names ("hermit crab" alongside *Pagurus bernhardus*) | Free, ~10 req/sec |
| **[FishBase](https://www.fishbase.se/)** | Fish-only — biology, ecology, photos, distribution | `https://fishbase.ropensci.org/` (REST mirror) or scrape | Body shape attributes, depth ranges, hero photos for fish | Free, but rate-limited |
| **[NBN Atlas](https://nbnatlas.org/)** (UK biodiversity) | UK-specific occurrence data | `records-ws.nbnatlas.org/occurrences/search` | Native UK records, finer-grained than OBIS for British waters | Free |

**Recommendation:** OBIS as the primary biogeographic filter (marine-focused, generous API), WoRMS as the taxonomy spine (we'll resolve all our scientific names through WoRMS to get AphiaIDs), and FishBase for enrichment (photos, body shape) where applicable. Skip GBIF for v1 — OBIS covers our needs and is purpose-built for marine.

---

## 6. Concrete API call examples

### OBIS — "what species occur within 50km of Bideford Bay, 15-25m depth, in July?"

```http
GET https://api.obis.org/v3/checklist
  ?geometry=POLYGON((-4.7 50.8,-4.0 50.8,-4.0 51.3,-4.7 51.3,-4.7 50.8))
  &depthfrom=15
  &depthto=25
  &startdate=2024-06-01
  &enddate=2024-08-31
  &size=200
```

Response (abridged):
```json
{
  "results": [
    { "scientificName": "Pagurus bernhardus", "records": 1247, "taxonRank": "species", "aphiaID": 107232, ... },
    { "scientificName": "Trisopterus minutus", "records": 412, ... },
    ...
  ]
}
```

We cache this per (deployment, depth-bucket, month-of-year) — say weekly refresh. ~50 species per checklist, maybe 12 cache keys total = trivial storage.

### WoRMS — vernacular name lookup

```http
GET https://marinespecies.org/rest/AphiaVernacularsByAphiaID/107232

[
  { "vernacular": "Common hermit crab", "language_code": "eng", "isPreferredName": 1 },
  { "vernacular": "hermit crab", "language_code": "eng" },
  { "vernacular": "Bernard l'ermite", "language_code": "fra" },
  ...
]
```

We extend our `TaxonAlias` table with these as `source: "vernacular"`. One-time backfill + periodic refresh.

### FishBase (optional v2) — body shape + photo

```http
GET https://fishbase.ropensci.org/species?genus=Trisopterus&species=minutus

{
  "BodyShapeI": "fusiform / normal",
  "DemersPelag": "demersal",
  "DepthRangeShallow": 15,
  "DepthRangeDeep": 300,
  "PicPreferredName": "Tr_minu_u0.jpg",
  ...
}
```

Drives our auto-tagging of `TaxonAttribute` records.

---

## 7. Schema additions

Lean — single new table, additive.

```prisma
model TaxonAttribute {
  id        String  @id @default(cuid())
  taxonId   String
  key       String  // "functionalGroup" | "bodyShape" | "locomotion" | "screenZone" | "colorTag" | "depthMin" | "depthMax"
  value     String  // "fish" | "streamlined" | "swimming" | "midwater" | "silvery" | "5" | "300"
  source    String  // "manual" | "fishbase" | "worms" | "user"
  taxon     Taxon   @relation(fields: [taxonId], references: [id], onDelete: Cascade)

  @@index([taxonId])
  @@index([key, value])
}

model BiogeographicChecklist {
  // Cached OBIS checklist results, keyed by (deployment, depthBucket, monthOfYear)
  id            String   @id @default(cuid())
  deployment    String   // "Algapelago"
  depthBucket   String   // "15-25"
  monthOfYear   Int      // 1-12
  scientificNames String[] // accepted scientific names from OBIS
  fetchedAt     DateTime @default(now())

  @@unique([deployment, depthBucket, monthOfYear])
}
```

`Taxon` itself doesn't change — attributes hang off it. Backfill is a script.

---

## 8. UX flow — entry points

The ID guide should be reachable from **two places**:

### A. Below the species name input
```
[ Type species name______________ ]
                    or
        [ 🤔 Help me figure it out → ]
```
Tap → opens the guide overlay. On finish, the chosen species pre-fills the input, user confirms. **Counts as a normal answer with full points** — no penalty for using the guide. (Engagement principle: we want people to *learn how to look*, not punish them for being unsure.)

### B. After a "Did you mean?" dead end
If the matcher returns no good fuzzy suggestion, the prompt becomes:
> "We don't recognise that. Want to try the **ID guide** instead?"

---

## 9. Implementation plan — phased

### Phase A — Static decision tree (no external APIs) — ~3 days
- Add `TaxonAttribute` table
- Manually tag the 58 taxa with `functionalGroup`, `bodyShape`, `locomotion`, `screenZone`, `colorTag` (1 hour of curation)
- Build the 5-question UI as a modal overlay
- Filter local taxa by attributes; rank by match-score
- Pre-fill answers from clip's `functional_group` + bbox path

**Outcome:** beginner can pick from buttons and get a useful shortlist. No external dependencies. Shippable.

### Phase B — OBIS biogeographic filter — ~2 days
- Add `BiogeographicChecklist` cache table
- Build a worker that hits OBIS for our deployment(s) at month/depth combinations and caches results
- Use the checklist as a soft prior in ranking — not a hard filter (we don't want to exclude a species the user genuinely saw just because it's rare for the area)

**Outcome:** the guide says "Sand goby — common at this site in summer, 12% chance" instead of just "Sand goby". Adds credibility and education.

### Phase C — WoRMS vernacular + photo enrichment — ~2 days
- Resolve all our `Taxon.scientificName` to WoRMS AphiaIDs (one-time, ~30 min batch)
- Pull vernacular names from `AphiaVernacularsByAphiaID` → extend `TaxonAlias`
- For taxa missing `heroImageUrl`, attempt FishBase or Wikipedia Commons lookup

**Outcome:** the matcher accepts more names without us hand-curating, and species pages get richer.

### Phase D — Smart pre-fill from bbox path — ~1 day
- Compute `meanY`, `pathLength`, `darting score` from bbox track
- Pre-fill Q2 (movement) and Q3 (screen position) automatically
- User can correct, but most won't need to

**Outcome:** the guide feels almost magical for clips with bboxes — "I noticed this one was on the seabed and moving in bursts. Is it…?"

### Phase E — Stretch: AI suggestion (post-MVP)
- Ship a "Show me your best guess" button that feeds the clip thumbnail to a vision API
- Surface as a *suggestion*, not an answer. User still confirms via the guide.

---

## 10. Things to validate with PEBL before building

1. **Manual attribute tagging.** Are PEBL staff willing to spend ~1 hour tagging the 58 taxa with body shape / movement / colour? It's a one-time cost. Alternative: I tag them from FishBase / Wikipedia and PEBL reviews.
2. **OBIS attribution.** OBIS data is CC-BY. We'll need to credit them somewhere (footer or species page). Confirm OK.
3. **Cache freshness.** Monthly checklist refresh is fine for our use case but worth confirming PEBL is happy with that latency.
4. **Vernacular conflicts.** WoRMS sometimes lists vernaculars that conflict with what UK fishermen actually say. Do we trust WoRMS or local ground truth more? My recommendation: prefer local PEBL-curated names over WoRMS where they differ.

---

## 11. Out of scope (explicitly)

- Visual recognition / computer vision (Phase E stretch only)
- Sound-based ID (some marine creatures are audible but our clips have no audio)
- AR overlay or live camera feed
- Multi-creature clips (one ID per clip for now)
- Open-ended user-suggested vernacular contributions (parked in main strategy doc Phase 3)

---

## 12. Why this is the right next bet

After the lean Phase 1 lands and we get user feedback, the most likely friction will be:
- "I don't know how to spell what I see"
- "I typed a generic word and got told I'm wrong"
- "I gave up after the second wrong guess"

The ID guide directly addresses all three, **and** it makes the app educational in the way the strategy doc promises ("learn through doing"), **and** it pulls in real biogeographic data so users feel they're connecting with the science, **and** it scales beyond PEBL's capacity (the question UI is the same regardless of taxon count, so adding 100 more species is free).

Estimated total effort across A–C: **~1 week** of focused work. Phase A alone is shippable in 3 days and would already close the gap meaningfully.

---

## Sources

- [GBIF API Reference](https://techdocs.gbif.org/en/openapi/) — global biodiversity occurrence search
- [OBIS Data Access](https://obis.org/data/access/) — marine-specific checklist endpoint
- [Querying OBIS, GBIF, and Fishbase with AphiaIDs (GBIF blog)](https://www.gbif.us/post/2024/searching-with-aphiaids/) — the cross-database identifier story
- [Merlin Bird ID FAQs (Cornell Lab)](https://support.ebird.org/en/support/solutions/articles/48000961587-merlin-bird-id-faqs) — Step-by-Step ID UX
- [Sussex IFCA Fish ID Guide](https://secure.toolkitfiles.co.uk/clients/34087/sitedata/files/Authority_Reports/Fish-ID-Guide-Complete.pdf) — UK fish identification keys (free PDF)
- [WoRMS REST API](https://www.marinespecies.org/rest/) — taxonomic resolution + vernaculars
- [FishBase REST mirror (rOpenSci)](https://fishbase.ropensci.org/) — fish biology API
