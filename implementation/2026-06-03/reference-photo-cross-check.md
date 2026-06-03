# Fish reference-photo head-to-head — final verdicts (APPLIED)

**Date:** 2026-06-03
**Method:** agentic team, one judge agent per species. Each judge downloaded and *visually
viewed* three sources — the committed photo, an independent workflow pick, and a fresh sweep of
the current top research-grade CC iNaturalist candidates — then chose the single best-fit teaching
reference. Tie-breakers, in order: (1) correct single-specimen view & right species; (2) sharpness
+ frame fill; (3) uncluttered/natural, live in-situ over dead/hand/deck; (4) clarity of diagnostic
features; (5) more permissive licence.

## Outcome

- **27 species judged. 14 committed picks kept, 13 changed (8 → independent workflow pick, 5 →
  fresh discovery).**
- All 13 changes applied to `src/data/species-images.json`, refreshed into the DB
  (`curated=true`), stale prior curated rows pruned, and verified end-to-end through the live API
  (lead photo = chosen pick). All licences are cc-by or cc-by-nc (within policy).

### Two real errors the panel caught (both missed by the earlier passes)

- **Trachurus trachurus** — the committed photo (which the first workflow had *also* independently
  picked, so it was a false "agreement") is labelled **Trachurus picturatus** (blue jack mackerel)
  on iNat, i.e. **wrong species**. Replaced with a genuine T. trachurus (IHUNTA, obs 243503722).
- **Scomber scombrus** — committed pick was **multiple fish in a tub**, useless as an annotation
  base. Replaced with a clean single lateral (Julien Renoult, cc-by, obs 7496873).

## Changed (13) — now live

| Species | New obs | Licence | Why it won |
|---|---|---|---|
| Pollachius virens | 326087211 (Julien Savoie) | cc-by | Only complete mature adult in clean full lateral; committed was a dull desiccated dead fish. |
| Gadus morhua | 276731063 (hawkhawk) | cc-by-nc | Only live in-situ single adult lateral; committed was a dead fish gripped against waterproofs. |
| Labrus bergylta | 135841745 (Donald Davesne) | cc-by | Live in-situ lateral; committed was a netted specimen with a hand in frame. CC-BY. |
| Symphodus melops | 183218189 (Itai Grisaru) | cc-by-nc | Full-body lateral with caudal spot + cheek lines; committed was soft & only 800px. |
| Ctenolabrus rupestris | 221786234 (Libby Keatley) | cc-by | Live in-situ, both diagnostic spots; committed was a dead deck specimen on concrete. |
| Gobiusculus flavescens | 344850333 (Tony Gilbert) | cc-by-nc | Fins fanned showing blue dorsal lines + caudal spot; committed had fins folded. |
| Pleuronectes platessa | 211448660 (zumbleistift) | cc-by-nc | Clean eyed-side top-down with vivid orange spots; committed was washed-out, held vertically. |
| Mullus surmuletus | 68641746 (Bernard Picton) | cc-by | Diagnostic chin barbels extended (hidden in committed); higher res; CC-BY. |
| Trachurus trachurus | 243503722 (IHUNTA) | cc-by-nc | **Committed was the wrong species (T. picturatus).** Lateral scute row readable. |
| Scomber scombrus | 7496873 (Julien Renoult) | cc-by | **Committed was multiple fish in a tub.** Clean single lateral, wavy bars clear. CC-BY. |
| Sprattus sprattus | 51071599 (Ulf Teghammar) | cc-by-nc | Fully unobstructed lateral on plain background; committed had fingers across the body. |
| Atherina presbyter | 64310889 (Klaus Kevin Kristensen) | cc-by | Live in-situ lateral, silver stripe; committed was a hand-held out-of-water shot. CC-BY. |
| Taurulus bubalis | 365505710 (lucane) | cc-by-nc | Sharp 2048px lateral on clean rock; committed was only 640px on red-on-red weed. |

## Kept (14) — committed pick confirmed best after viewing alternatives

Trisopterus luscus, Trisopterus minutus, Labrus mixtus, Conger conger, Pholis gunnellus,
Pomatoschistus microps, Gobius paganellus, Pomatoschistus minutus, Callionymus lyra,
Scyliorhinus canicula, Chelon labrosus, Dicentrarchus labrax, Lipophrys pholis,
Spinachia spinachia.

Notable holds: Pholis gunnellus + Spinachia spinachia kept their committed photo specifically
because the alternatives cropped the defining whole-body trait (the ocelli row / the long caudal
peduncle); the workflow picks lost on that. Conger conger + Callionymus lyra: the fresh sweep was
dominated by misidentified lookalikes (a land snake under "conger"; wrasses under "dragonet"), so
the committed in-situ shot held.

## Notes / residue

- The 26 invertebrates and pollack (Pollachius pollachius) were already curated and were out of
  scope for this head-to-head.
- Catalogue species added today and NOT covered here: Callionymus maculatus (spotted dragonet),
  Limanda limanda (dab), Platichthys flesus (flounder) — they have iNat buckets but no curated
  override yet; a future pass should give them the same treatment.
- This file supersedes the pre-decision cross-check; the per-pick reasoning + runner-up notes live
  in workflow run wf_86005d19-c73.
