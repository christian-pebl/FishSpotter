# PEBL FishSpotter — Engagement & Education Strategy

> Strategic plan for evolving FishSpotter from an identification game into a tool that connects North Devon fishermen, sailors, surfers, and nature enthusiasts with the marine biodiversity of Bideford Bay (the *Algapelago* deployment area).

---

## 1. Audit — what's there today

A tight, mobile-first vertical-feed identification game. The core loop works:

> Watch clip (with bbox tracking the creature) → type species name → fuzzy-matched against `staffAnswer` → see community % distribution → next clip.

**Strengths:** snappy loop, smart fuzzy matching with "did you mean?", streak counter, leaderboard, PWA-ready, mobile-first responsive layout.

**Gaps blocking engagement & education:**

- **No species learning moment.** After answering, users see only a percentage bar — the highest-value teaching opportunity in the entire app is wasted.
- **No place context.** `lat`, `lon`, `depthM`, `recordingDatetime`, `site` stored in the schema but never surfaced. Users have no sense this is *their bay*.
- **Free-text only ID.** Brutal for beginners — typing "Salema porgy" cold is a quitter's experience.
- **Vernacular missing.** Algarve fishermen don't say "Salema porgy" — they say *salema*. The grader doesn't know that.
- **No social fabric.** No comments, profiles, or "I saw one of these last Tuesday off Olhão" — the local-knowledge layer fishermen actually live in.
- **Onboarding is a 6-second toast.** First-timers get no scaffolding.
- **All current clips have `staffAnswer = "Unknown"`** so the game can't be won (artefact of the local seed).

## 2. Three audiences — what each needs

| | **North Devon fishermen** | **Sailors, surfers, divers** | **Marine-curious public & schools** |
|---|---|---|---|
| **Profile** | Pot fishermen (lobster, crab), recreational anglers, scallop dredgers around Bideford / Westward Ho! / Bude | Substantial RYA scene off N. Devon coast; Croyde / Saunton surfing community; BSAC dive clubs | Locals, holidaymakers, RNLI volunteers, National Trust members, Devon schools (Atlantic Highway tourism corridor) |
| **Time available** | Tiny windows (dock, lulls) | Seasonal, weather-dependent | Variable |
| **Tech profile** | WhatsApp-fluent, mixed | Mixed, often app-fluent | Digitally native |
| **What they already have** | Deep tacit knowledge of bay species & seasons | Direct sea-time observation; sometimes underwater visual data | Curiosity, time, no expertise |
| **Will engage if…** | Respects their expertise; uses vernacular ("pouting" not *Trisopterus*); doesn't lecture; reciprocal info | Connects to their water — currents, conditions, what's around | Learning + community + sense of contribution |
| **Killer features** | Local-name dictionary; "first spotter" honour; site/season filters; vernacular accepted | Site map showing what's been seen near where they sail/dive/surf; reports of unusual sightings | Species pages; life list; badges; local leaderboard; classroom mode |

**Key research insight:** apps that succeed with maritime professionals are *reciprocal* — SAFMC's SciFish gives fishermen back regulatory clarity, Eye on Water gives sailors photos with provenance, eOceans gives divers personal logbooks. Apps that gamify without teaching ([criticism levelled at Seek/iNat](https://medium.com/@clairedlmk/when-gamification-goes-wrong-b19cca8842bd)) lose retention. Aim for **learning *through* gamification, not instead of it.**

## 3. North-star principles

1. **North Devon, not "the ocean."** Every screen should feel like *Bideford Bay* — local headland names, British coastal vernacular, the *Algapelago* deployment as identity anchor. ("Explore the Algapelago.")
2. **Every answer is a teaching moment.** Right or wrong, the user learns something about that species *right then* — not via a separate "library" they'll never click.
3. **Respect tacit knowledge.** Position fishermen as contributors whose observations improve the system, not as students.
4. **Reciprocal value loop.** Users give observations; the app gives them something back (alerts, knowledge, recognition, connection).
5. **Light social glue, not Twitter.** Comments-per-clip + village-level recognition, not feed/follow/notification spirals.
6. **The app scales beyond PEBL's labelling capacity.** Clips arrive faster than staff can label them. Unlabelled clips become "Help us ID" challenges that reward users for contributing — the iNaturalist "research grade" pattern. Users grade together, the system self-improves.

## 4. The phased plan

### **Phase 0 — Make the existing loop actually work** *(1–2 days, table stakes)*

- Real `staffAnswer` data for the 23 clips (game can't be won today)
- Multiple-choice mode alongside free-text (free-text becomes "expert mode" with score multiplier)
- Surface place + time on every clip card (data already in DB, just unused)

### **Phase 1 — Species pages + local names** *(see `phase-1-species-pages.md`)*

The single biggest engagement & education multiplier. Adds the species data model, vernacular alias matcher, post-answer reveal panel, life list, and species pages.

### **Phase 2 — Place & community** *(2 weeks)*

- Map view with deployment markers (Leaflet/Maplibre)
- Site pages (`/site/[id]`) — gallery, species seen, seasonal pattern, top spotters
- Comments per clip with optional "local knowledge" tag
- Local leaderboards (per village/site)
- First-spotter recognition on species pages (permanent credit)

### **Phase 3 — Make fishermen central, not subjects** *(3–4 weeks)*

- "Fisherman's note" mode — voice memo or short text attached to clip/species
- Local-expert badge — users with high agreement become community-graders
- Vernacular contributions — community-built Algarve folk-taxonomy
- Practical reciprocity for farmers — site biodiversity dashboards, invasive alerts

### **Phase 4 — Sustained engagement loops** *(ongoing)*

- Weekly "Mystery Clip" with hidden answer
- Seasonal challenges aligned to Algarve calendar
- Streaks with grace (freezes / weekend pass)
- Community goals (per-site monthly targets)
- Opt-in digest emails
- Schools mode (classroom code + teacher dashboard)

### **Phase 5 — Stretch / horizon**

- AI-assisted ID hints (Pl@ntNet/Merlin model)
- User-uploaded clips
- Integration with Reef Life Survey, OBIS, iNaturalist
- Boat companion mode (offline pack)

## 5. Open questions to validate

- **Region confirmation** — ALG_SC = Algarve? Which specific sites?
- **Design partners** — local fishing co-op or Ria Formosa shellfish association PEBL works with? Don't build for them without them.
- **Labelling workflow** — are species labels generated by model, by hand, both? Determines whether staff answers are gospel or proposals.
- **Device reality** — Android prevalence, low-end devices? Affects bbox/video bitrate.

## References

- [Marine Community Science: How Everyday Heroes Track Ocean Giants](https://www.marinebiodiversity.ca/marine-community-science-how-everyday-heroes-track-ocean-giants/)
- [Participatory Monitoring — Citizen Science for Coastal Environments (Frontiers)](https://www.frontiersin.org/journals/marine-science/articles/10.3389/fmars.2021.681969/full)
- [SAFMC Citizen Science (SciFish)](https://safmc.net/citizen-science/)
- [eOceans Citizen Science](https://www.sharkguardian.org/eoceans-citizen-science)
- [Black Sea Watch — citizen-science marine biodiversity app](https://sdgs.un.org/partnerships/promoting-citizen-science-using-appwebsite-protection-black-sea-marine-biodiversity)
- [iNaturalist Forum: long-term direction for iNat, Seek, gamification](https://forum.inaturalist.org/t/whats-the-long-term-direction-for-inat-seek-and-gamification/47546)
- [When Gamification Goes Awry: The Seek App](https://medium.com/@clairedlmk/when-gamification-goes-wrong-b19cca8842bd)
- [Wildlife-watching apps overview — Merlin Bird ID life list pattern](https://shopeverbeam.com/blogs/news/10-best-apps-for-wildlife-watching-enhance-your-nature-experience)
- [PEBL Marine Monitoring Products](https://www.pebl-cic.co.uk/products)
