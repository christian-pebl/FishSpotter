# Claim verification proposal format

One file per species at `.refs-cache/proposals/<SafeSpeciesName>.json`.
`scripts/refs/apply-proposals.ts` reads them and writes the repo.

A proposal is a **record of reading**, not a record of believing. Every
`support` entry must be a passage that exists verbatim in the cached source
text. The merge script re-checks each quote against the cached file and drops
any it cannot find, so an invented or tidied quote fails loudly instead of
being written into the app as evidence.

## What the species guide is for

The guide is a plain reflection of what the standard reference databases say
about the animal: MarLIN, FishBase, SeaLifeBase, WoRMS, FAO species
catalogues, and the peer-reviewed literature behind them. Broad, general
scientific knowledge.

It is **not** a description of the animal's role on a seaweed or mussel farm,
and it is **not** a read-out of PEBL's own 72-species catalogue or food-web
diagram. If a statement would only make sense to someone who knew about our
farm work, it does not belong on this page. Write what a marine biologist
would say about the species anywhere in the north-east Atlantic.

```jsonc
{
  "species": "Gadus morhua",

  "facts": {
    "depth":     { "text": "0-600 m, usually 150-200 m",
                   "support": [ { "sourceId": "...", "locator": "...", "quote": "..." } ] },
    "size":      { "text": "Up to 200 cm, commonly around 100 cm", "support": [ /* ... */ ] },
    "habitat":   { "text": "Benthopelagic over sand, gravel and rock on the continental shelf",
                   "support": [ /* ... */ ] },
    "behaviour": { "text": "Schools by day 30-80 m above the bottom, dispersing at night to feed",
                   "support": [ /* ... */ ] }
  },

  "claims": [
    {
      "key": "mark:cmpz...",              // exactly as given in the brief
      "verdict": "corrected",             // supported | corrected | unsupported
      "correctedLabel": "Pale curved lateral line",
      "correctedText": "A pale, strongly curved line runs along the flank.",
      "support": [ { "sourceId": "...", "locator": "...", "quote": "..." } ],
      "note": "MarLIN describes the lateral line as pale and curved."
    },
    {
      "key": "fieldNote",
      "verdict": "supported",
      "support": [ /* ... */ ]
    }
  ],

  "diet": {
    "eats": [
      {
        "text": "Fish, especially herring, capelin and sandeels",
        "slug": "sprat",                  // OPTIONAL, see below
        "support": [ { "sourceId": "...", "locator": "...", "quote": "..." } ]
      }
    ],
    "eatenBy": [ /* same shape */ ]
  },

  "newSources": [
    {
      "id": "marlin:2095",                // "<publisher-key>:<stable-id>"
      "kind": "marlin",                   // see SOURCE_KINDS in schema.ts
      "title": "Atlantic cod (Gadus morhua)",
      "publisher": "Marine Biological Association of the UK",
      "year": 2008,
      "url": "https://www.marlin.ac.uk/species/detail/2095",
      "licence": "CC BY-NC-SA 4.0",
      "expectText": ["Gadus morhua"]
    }
  ]
}
```

## The four fact tiles

`facts` replaces four claims that used to be rendered from the Spot It
wizard's trait tokens. Those tokens (`small`, `kelp`, `solitary`, ...) exist to
CUT a candidate list off a short clip. They are good questions and bad facts:
they made the corkwing wrasse "Small (under 10 cm)" against a source saying it
reaches 25 cm. The wizard keeps them; the tile no longer renders them.

Write each tile as a short phrase (**160 characters max**, ideally well under)
in the source's own terms:

| tile | write | do not write |
|---|---|---|
| `depth` | `0-600 m, usually 150-200 m` | `Deep` |
| `size` | `Up to 25 cm, usually under 15 cm` | `Small (under 10 cm)` |
| `habitat` | `Rocky shores among seaweed and in lower-shore pools, to about 50 m` | `Kelp, Rocky crevice` |
| `behaviour` | `Territorial; males build and guard a seaweed nest` | `Solitary` |

Rules:
- Give a size as the **maximum length a source states**, and the common length
  when one is given. Never convert it to a bucket.
- Prefer the source's own framing and units. Do not round a stated range.
- A tile with no passage behind it is simply **omitted** from `facts`. The tile
  then does not render. Never write a plausible phrase to fill a gap.
- These are for a general reader, so plain words beat jargon where a source
  gives you the choice; keep the technical term when it is the actual claim
  (`benthopelagic`, `catadromous`) and it is doing real work.

## Verdicts, for the `claims` array

The `claims` array covers the diagnostic-mark rings and the field note.

| verdict | meaning | what the merge does |
|---|---|---|
| `supported` | a passage carries the claim as it stands | records the passage, sets `claimSupported: true` |
| `corrected` | a passage contradicts the claim and states the right answer | records the correction and the passage |
| `unsupported` | no consulted source states this either way | drops the claim; the app stops rendering it |

There is deliberately no "probably true" verdict. If no passage carries it,
it is `unsupported` and it comes off the page. An unsupported ring is not
drawn; an unsupported field note is not shown.

## The diet bullets

Write what a marine biologist would say the animal eats, **not** what our
72-species catalogue happens to contain. "Small crustaceans, worms and
molluscs picked off the seabed" is a good bullet. "Shore Crab" is a bad one
unless the source genuinely singles that species out.

- Three bullets a side is the target. Two is fine when a source only supports
  two. Never invent a third.
- Prefer the source's own framing: MarLIN's `Typically feeds on:`, FishBase's
  `Food items` / `Predators`, SeaLifeBase, or a diet study's results.
- The brief's `foodWebContext` shows what PEBL's farm diagram currently draws.
  It is there so you can see what is being replaced. Copying it defeats the
  entire point of the change.
- Set `slug` only when the bullet's headline subject really is one catalogue
  species and the source names it. A wrong link is worse than no link. Leave it
  out for group statements.
- An animal with no recorded predators legitimately has an empty `eatenBy`.
  Say so in a `note` rather than reaching for a plausible guess.

## Rules that have already been broken once

- **Never construct a FishBase `FoodItemsList.php` URL.** It renders its
  heading from the URL's genus/species but its rows from the stock code, so a
  hand-built URL returns a page headed with your species listing another
  animal's prey. Follow only the link FishBase itself publishes.
- **Check the page is about your species**, by its own title, not by finding
  the binomial somewhere in the body. MarLIN's common-mussel page names both
  plaice and dab in its text.
- **A quote must be verbatim from the cached text.** Do not tidy, translate or
  join two sentences. Use `...` for an internal cut.
- **Do not set `supported` from a source you could not read.** If the cached
  file is missing and the fetch fails, that claim is `unsupported`.
