# Grounding a species-guide claim

How every factual statement on a species guide gets traced to an open-access
source, and how to add or fix one.

## The principle

Two trust levels, deliberately kept apart:

| Flag | Set by | Proves |
|---|---|---|
| `linkVerified` | `npm run refs:verify` (machine) | The URL resolves, and the document says **in its own title** that it is about this species. |
| `claimSupported` | a read passage only | The source actually carries the claim the app makes. |

A script that cannot read the source may never set `claimSupported`. A gate that
verifies against its own subject proves self-consistency and nothing else, which
is worse than no gate because it manufactures confidence.

**Only verified sources are shown to a reader.** An unverified citation is held
back in `getSpeciesProvenance`, not rendered with a caveat: a citation that does
not resolve looks like diligence while being the opposite.

## Why the identity test is the page title, not the page body

MarLIN's common-mussel page (`/species/detail/1421`) names both *Pleuronectes
platessa* and *Limanda limanda* in its text. An earlier body-containment test
therefore bound plaice **and** dab to a bivalve. Both matched, both were wrong.

The title is the identity claim a page makes about itself, so that is what gets
tested. BTO is the documented exception: its titles are vernacular ("Shag |
BTO"), so those resolve on title-names-the-bird **plus** body-names-the-binomial.

The same trap, worse, on FishBase: `TrophicEco/FoodItemsList.php` renders its
heading from the genus/species query parameters but its rows from the stock
code. Guess the stock code and you get a page headed "Food Items - Pollachius
pollachius" listing freshwater African tilapia prey. **Never construct that URL.**
`refs:diet` only follows the link the species' own summary page publishes, and
still re-checks that the resulting page names the predator.

## The pipeline

```bash
npm run refs:resolve     # WoRMS identity + MarLIN / FishBase / BTO links, each proved
npm run refs:verify      # the external gate: re-check every link against the live web
npm run refs:extract     # bind field notes, marks, traits and diet to read passages
npm run refs:diet        # bind individual food-web feeding links to FishBase diet records
npm run refs:audit       # the scorecard: what is bound, what is not
```

Useful flags: `--species "Gadus morhua"`, `--limit N`, `--dry-run`, `--force`
(re-resolve an already-resolved species), `refs:verify -- --check` (read-only,
non-zero exit, for CI), `refs:verify -- --stale-only` (only links older than 30
days), `refs:audit -- --queue` (list the unbound claims, most user-visible
first).

Pages are cached to `.refs-cache/` (gitignored). Delete it to force refetch.

## Files

| Path | Role |
|---|---|
| `src/data/species-references.json` | The data: source registry + per-species identity and claim bindings. Committed. |
| `src/data/reference-verification.json` | Machine-written verification results. Committed, so CI has a baseline. |
| `src/lib/references/schema.ts` | Zod schema. Adding a source kind starts here. |
| `src/lib/references/catalogue.ts` | The validated loader. **Import `REFERENCES` from here, never the raw JSON.** |
| `src/lib/references/payload.ts` | Builds the server-side provenance payload (verified sources only). |
| `src/lib/references/catalogue.test.ts` | Structural CI gate: no dangling ids, no unciteable source, no hollow `claimSupported`. |
| `src/components/species/SpeciesSources.tsx` | The Sources block, identity line and superscript markers. |
| `src/app/api/species/references/route.ts` | Serves provenance so the reference catalogue never ships to the browser. |

## Claim keys

Claims are addressable so binding can be exhaustive rather than vague. Build
them with the `claimKey` helpers in `catalogue.ts`, never by hand:

```
fieldNote                     the prose field note
mark:<diagnosticMarkId>       one diagnostic-mark description
trait:size | habitat | behavior
diet:eats | diet:eatenBy      the species-level diet statements
trophic:tier                  its tier in the food web
farm:role                     created / enhanced / harmed / anyway
edge:<prey>-><predator>       one feeding link
```

## Adding a source by hand

1. Add it to `sources` in `species-references.json` with `kind`, `title`,
   `publisher`, `url`, and `expectText` (the strings that prove the page is
   about the species). Without `expectText` the test fails: an unprovable link
   is not a citation.
2. Add its id to the species' `sourceIds`.
3. Bind it under `claims`, with a `support` entry recording `locator`, a short
   `quote`, `readBy` and `readOn`.
4. Set `claimSupported: true` **only** if you read the passage and it carries
   the claim.
5. `npm run refs:verify` then `npm test src/lib/references`.

## What is deliberately not sourced this way

- **Photographs** carry their own author, licence and source link via
  `SpeciesImage` and the gallery's provenance popover.
- **Depth and distribution** come from OBIS occurrence records, not from the
  sources above, and are labelled as such on the guide.
- **Books held only as an unauthorised copy** (`decision-tree/id-guides/` holds
  libgen copies of Hayward & Ryland and Sterry). Citing a book by page is normal
  scholarship; shipping text extracted from those copies into the UI is not.
  Cite them by page if needed, and prefer an open-access source for anything a
  reader actually sees.
