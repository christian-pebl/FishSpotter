# Species coverage audit (4 Jun 2026)

Audited all **57 species** in the DB on three axes: gallery photo count, curated count, and
diagnostic-mark count. Two gaps surfaced.

## Gap 1 — gallery photos < 5 (the image gap)
9 species. Agent-team deep search (NOAA/Smithsonian/GBIF/Artsobservasjoner/Openverse/stock/
Flickr-CC/aquaria/deep-iNat) found openly-licensed photos the gallery builder had missed, so all
but the two baitfish were enriched:

| Species | before | after | how |
|---|---|---|---|
| Saithe (Pollachius virens) | 4 | **9** | +Fiege/Smithsonian/le0p0ld_d (CC-BY/SA) |
| Sand smelt (Atherina presbyter) | 4 | **8** | +Ecomare/Kristensen/franciscodocampo (CC-BY/SA) |
| Conger eel (Conger conger) | 4 | **7** | +Aquarium Finisterrae/Rumsby/Siskopoulos |
| Veined Squid (Loligo forbesii) | 4 | **7** | +Gordon Shepherd (CC0)/Snorre Bakke (CC-BY) |
| Barrel Jellyfish (Rhizostoma octopus) | 4 | **7** | +Pistevos/sam_aeostomeae/Bonifazi |
| Spotted dragonet (Callionymus maculatus) | 4 | **5** | +Ifremer/Wetterström (genuinely sparse species) |
| Poor cod (Trisopterus minutus) | 4 | **5** | +Prigge/phil_newman |
| **Atlantic mackerel (Scomber scombrus)** | 2 | 2 | no usable open OR ARR live photo exists |
| **Sprat (Sprattus sprattus)** | 3 | 3 | no live open photo exists → permission emails drafted |

All additions are CC0/CC-BY/CC-BY-SA/CC-BY-NC, URL-verified, agent-ID-checked; live on prod.
The two baitfish are the only true ceilings — see `permission-email-drafts.md` (sprat → Arne
Kuilman / Erling Svensen). Mackerel has no licensable live shot at all.

## Gap 2 — no diagnostic marks (the guide gap) — RESOLVED 4 Jun 2026
This section was already stale when written: a parallel session's
`scripts/place-diagnostic-marks.ts author --apply` run had created 3 marks each for all 15
(Atlantic mackerel, Sprat, Saithe, Spotted dragonet, Sand smelt, Dab, Atlantic cod, Ballan
wrasse, Corkwing wrasse, Goldsinny wrasse, Two-spotted goby, Plaice, Flounder, Red mullet,
Long-spined sea scorpion). The marks existed but were poorly PLACED (the Gemini box_2d placer
graded only 2/15 aligned; 13/15 had rings over open water or the wrong body end).

**Fix (supervisor + 15 parallel agents):** rendered each species' current marks with the exact
`AnnotatedSpeciesPhoto` geometry, fanned out one agent per species to re-place the rings from the
photo (independent Claude-vision pass), applied all 45 coords centrally, re-rendered, and
supervisor-eyeballed all 15. Caught + hand-fixed one orientation flip (Saithe jaw → head). All 45
marks now on-feature; DB live on prod. Review artifact:
`mark-renders/_CONTACT-SHEET.png`. Coords + per-mark agent reasoning in
`mark-corrections.json`; current/before placements in `placement-log.json`.
