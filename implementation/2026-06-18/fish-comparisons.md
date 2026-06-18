# Fish "tell them apart" comparisons, extended to all confusable groups (18 Jun 2026)

Extends the side-by-side compare view (built first for flatfish) to every
confusable fish group. One comparison group per fish Rung-2 `fishGroup`, so a
group's members ARE the Rung-3 candidate set for that tile. Cues compiled by a
6-agent literature sweep (one per group) cross-checked against MarLIN, FishBase,
the Wildlife Trusts and the local UK guides (Sussex IFCA, ZSL). Every cue is
video-visible (no in-hand characters like fin-ray or scute counts).

Data: `src/lib/idflow/comparisons.ts` (`COMPARISON_GROUPS`). Layout adapts: 3
members fill the row, 4 to 7 scroll horizontally. Each card is tap-to-commit.

## Cod-shaped (gadoids): pollack, saithe, cod, whiting, bib, poor cod
Decision spine: **chin barbel first.** Barbel = cod / bib / poor cod; no barbel =
pollack / saithe / whiting.
- Pollack: no barbel, jutting lower jaw, dark lateral line kinked over the pectoral.
- Saithe: pale, nearly straight lateral line (the pollack mirror-image).
- Cod: long barbel + pale lateral line curving over the pectoral; big, spotty.
- Whiting: slim, silvery, no real barbel, dark spot at the pectoral base.
- Bib: deep coppery bream-shaped body, pale vertical bars, long barbel.
- Poor cod: small, plain, big-eyed, long barbel, no bars.
- Caveat: the dark pectoral-base spot is shared by bib, whiting and poor cod.
- Sources: FishBase + MarLIN per species; Sussex IFCA; British Sea Fishing for the pollack/saithe split.

## Wrasses: ballan, cuckoo, corkwing, goldsinny
Decision spine: two big colourful ones vs two small brown ones; for the small
pair, **where the tail-base spot sits.**
- Ballan: biggest, thick lips, all-over pale-freckled flank, no spots/comma.
- Cuckoo: male electric blue on orange; female pink with 2 to 3 dark rear-dorsal blotches (flag the sex difference).
- Corkwing: dark comma behind the eye + spot in the MIDDLE of the tail base.
- Goldsinny: one dark spot at the TOP of the tail base + a front-dorsal spot.
- Sources: MarLIN + Wildlife Trusts per species; Seasearch Ireland wrasse guide.

## Gobies & dragonets: dragonet, spotted dragonet, two-spotted goby, rock, sand, common
Decision spine: **shape (flat wide-headed dragonet vs round-bodied goby), then
where it sits.** Honesty flag built in: the small Pomatoschistus gobies (sand,
common) cannot be reliably split on video, so "a small goby" is the correct
coarse answer (valid partial credit under scored-by-rung).
- Dragonet: flat triangular head, eyes on top, on sand; male tall sail-fin.
- Spotted dragonet: smaller, rows of fin spots; "a dragonet" is a fair fallback.
- Two-spotted goby: hovers UP in midwater, dark tail-base spot.
- Rock goby: dark, chunky, on rock, pale upper edge to the front dorsal.
- Sand / common goby: pale on open sand, usually not separable on video.
- Sources: MarLIN + FishBase; Glaucus/BMLSS. (MarLIN now files the two-spotted goby under Pomatoschistus flavescens; same fish.)

## Other bottom fish: tub, red, grey, streaked gurnard + red mullet, sea scorpion, shanny
Decision spine: three instant (chin whiskers = red mullet; smooth no-belly-fin
rockpool fish = shanny; long cheek spine = sea scorpion); the four gurnards split
on **pectoral-fin colour / body pattern.**
- Tub gurnard: huge pectorals with a vivid blue margin.
- Red gurnard: red body, bony plates along the lateral line, steep head.
- Grey gurnard: grey-brown, dark blotch on the first dorsal, white-spotted back.
- Streaked gurnard: oblique dark body bars, short rounded snout.
- Caveat: tub and streaked both show blue on the fins; split by body (tub clean reddish, streaked barred).
- Sources: MarLIN + FishBase per gurnard; Wildlife Trusts for mullet/scorpion/shanny.

## Silver swimmers: mackerel, scad, bass, mullet, sand smelt, sprat
Decision spine: **back pattern + side-line.**
- Atlantic mackerel: wavy tiger bars on a green-blue back + finlets; no scutes.
- Horse mackerel (scad): bony scute-line kinked to the tail + dark gill spot.
- Sea bass: clean silver, two separate dorsals (front spiny), dark gill spot.
- Thick-lipped mullet: blunt head, thick top lip, plain grey, no scutes.
- Sand smelt: slender, see-through, bright silver mid-flank stripe, two dorsals.
- Sprat: small, sharp saw-edged keeled belly, single dorsal.
- Caveat: the dark gill-cover spot is on both scad and bass; split by scute-line vs spiny gill edge.
- Sources: MarLIN + FishBase; National Mullet Club ID guide; ICES FishMap (sprat).

## Long and skinny: conger eel, butterfish, fifteen-spined stickleback
Not true look-alikes; build decides it.
- Conger eel: big, thick, scaleless grey eel; dorsal starts behind the pectorals.
- Butterfish: small flat ribbon with ~9 to 13 white-ringed black eyespots on the dorsal.
- Fifteen-spined stickleback: thread-thin, long snout, row of ~15 back-spines.
- Sources: MarLIN per species; Glaucus/BMLSS (butterfish); British Sea Fishing (stickleback).

## Verified
tsc 0 errors, lint + lint:tokens clean, 0 em/en dashes, `comparisons.test.ts`
(every member is a real catalogue species with a matching common name) green,
full suite 341/341. Driven live in the dev preview: the cod-shaped compare opens
with all 6 cards, the barbel-first tip, the "Swipe across to see all 6" hint, and
a working horizontal scroll (scrollWidth 856 > 529).
