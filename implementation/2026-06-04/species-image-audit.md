# Species reference-image & guide-hero audit

_Generated 2026-06-04. Inventory from Postgres (SpeciesImage + DiagnosticMark); guide-circle validation by Gemini gemini-3.5-flash, scoring a composite of each annotated hero rendered with the live AnnotatedSpeciesPhoto ring geometry._

## Headline numbers

- **57** catalogue species, **all 57 have reference photos** (none missing entirely).
- **42** have an annotated guide-hero (>=1 diagnostic mark); **15** have NONE and need one authored.
- Of the 42 heroes, only **8 are good as-is**. The rest: **25** reposition circles, **6** re-author/relabel marks, **3** replace the source photo.
- Only **8/42** heroes had MOST circles correctly aligned (Gemini overallAligned=true).

## P1 - REPLACE THE SOURCE PHOTO (dead/captive/wrong-angle; circles cannot be fixed) (3)

| Species | Sci name | Class | Photos | Curated | Marks | Clarity | Recommendation / fix |
|---|---|---|---|---|---|---|---|
| Edible Crab | _Cancer pagurus_ | crab | 7 | 1 | 4 | 30 | The photo shows an upside-down, dead crab shell missing its legs and claws, making it impossible to see the diagnostic features. Replace this photo with a live specimen showing its dorsal side and claws clearly. |
| Dragonet | _Callionymus lyra_ | fish | 13 | 3 | 3 | 45 | The photo shows a dead or captured fish being held in a hand out of water, which fails to demonstrate its natural flat-bottomed posture on sand. It should be replaced with an underwater photo of a live dragonet in its natural habitat. |
| Flat Top Shell | _Steromphala umbilicalis_ | gastropod | 9 | 1 | 4 | 35 | The current photo shows an eroded, algae-covered specimen from an overhead angle that completely hides the diagnostic open navel underneath. Replace this photo with one showing both the underside of the shell to reveal the umbilicus and a specimen with clear reddish-purple zigzag patterns. |

## P2 - NO GUIDE-HERO YET (author diagnostic marks on the curated photo) (15)

| Species | Sci name | Class | Photos | Curated | Marks | Clarity | Recommendation / fix |
|---|---|---|---|---|---|---|---|
| Atlantic cod | _Gadus morhua_ | fish | 6 | 1 | - | - | No guide-hero authored yet. Author marks on the curated photo. |
| Atlantic mackerel | _Scomber scombrus_ | fish | 2 | 1 | - | - | No guide-hero authored yet. Author marks on the curated photo. |
| Ballan wrasse | _Labrus bergylta_ | fish | 7 | 1 | - | - | No guide-hero authored yet. Author marks on the curated photo. |
| Corkwing wrasse | _Symphodus melops_ | fish | 8 | 1 | - | - | No guide-hero authored yet. Author marks on the curated photo. |
| Goldsinny wrasse | _Ctenolabrus rupestris_ | fish | 8 | 1 | - | - | No guide-hero authored yet. Author marks on the curated photo. |
| Long-spined sea scorpion | _Taurulus bubalis_ | fish | 8 | 1 | - | - | No guide-hero authored yet. Author marks on the curated photo. |
| Red mullet | _Mullus surmuletus_ | fish | 8 | 1 | - | - | No guide-hero authored yet. Author marks on the curated photo. |
| Saithe | _Pollachius virens_ | fish | 4 | 1 | - | - | No guide-hero authored yet. Author marks on the curated photo. |
| Sand smelt | _Atherina presbyter_ | fish | 4 | 1 | - | - | No guide-hero authored yet. Author marks on the curated photo. |
| Spotted dragonet | _Callionymus maculatus_ | fish | 4 | 1 | - | - | No guide-hero authored yet. Author marks on the curated photo. |
| Sprat | _Sprattus sprattus_ | fish | 3 | 2 | - | - | No guide-hero authored yet. Author marks on the curated photo. |
| Two-spotted goby | _Gobiusculus flavescens_ | fish | 8 | 1 | - | - | No guide-hero authored yet. Author marks on the curated photo. |
| Dab | _Limanda limanda_ | flatfish | 5 | 1 | - | - | No guide-hero authored yet. Author marks on the curated photo. |
| Flounder | _Platichthys flesus_ | flatfish | 8 | 1 | - | - | No guide-hero authored yet. Author marks on the curated photo. |
| Plaice | _Pleuronectes platessa_ | flatfish | 8 | 1 | - | - | No guide-hero authored yet. Author marks on the curated photo. |

## P3 - RE-AUTHOR / RELABEL MARKS (numbers swapped, scrambled, or duplicated) (6)

| Species | Sci name | Class | Photos | Curated | Marks | Clarity | Recommendation / fix |
|---|---|---|---|---|---|---|---|
| Velvet Swimming Crab | _Necora puber_ | crab | 9 | 1 | 4 | 85 | The red eye on the left is completely unlabelled, while marks 3 and 4 are misaligned over the mouthparts. Move mark 3 to the left red eye and consolidate or remove the redundant velvety shell marks. |
| Atlantic horse mackerel | _Trachurus trachurus_ | fish | 6 | 1 | 6 | 65 | The marker circles are completely scrambled, with the eye and tail labels pointing to the wrong ends of the fish, and the body markers being far too large. Re-author all markers to correctly target their corresponding features. |
| Dog Whelk | _Nucella lapillus_ | gastropod | 9 | 1 | 4 | 75 | Remove the redundant mark 4 and the missing mark 1. Shrink and reposition mark 2 to focus precisely on the pointed spire of the shell. |
| Blue Jellyfish | _Cyanea lamarckii_ | jellyfish | 9 | 1 | 4 | 45 | The current circles are nested, oversized, and poorly targeted, with circle 4 completely off the animal on the sand. The marks need to be completely re-authored with smaller, non-overlapping circles that point to the specific anatomical features. |
| Common Cuttlefish | _Sepia officinalis_ | squid | 8 | 2 | 3 | 85 | The labels for marks 2 and 3 are swapped. Swap the numbers so that mark 2 points to the fin and mark 3 points to the broad mottled body. |
| Spiny Starfish | _Marthasterias glacialis_ | starfish | 8 | 1 | 2 | 85 | The numbered labels are mismatched and placed on the wrong circles. The large teal rings correctly highlight the arms and spines, but the numbered dots are detached and misaligned. |

## P4 - REPOSITION / RESIZE CIRCLES (good photo, marks drift off the feature) (25)

| Species | Sci name | Class | Photos | Curated | Marks | Clarity | Recommendation / fix |
|---|---|---|---|---|---|---|---|
| Great Spider Crab | _Hyas araneus_ | crab | 5 | 1 | 4 | 35 | Most of the circles are misaligned and floating in the empty background space above the crab. They need to be repositioned to accurately target the crab's shell and legs. |
| Harbour Crab | _Liocarcinus depurator_ | crab | 9 | 1 | 4 | 75 | Circle 3 is completely off the animal and needs to be moved to the other paddle leg on the right side. Circle 2 should be adjusted slightly to better highlight the lateral teeth on the side of the shell. |
| Bib | _Trisopterus luscus_ | fish | 8 | 1 | 3 | 85 | The photo is excellent, but circles 1 and 2 are misaligned. Move circle 1 slightly up and right to cover the chin barbel, and move circle 2 back to the base of the pectoral fin. |
| Butterfish | _Pholis gunnellus_ | fish | 5 | 1 | 6 | 65 | Several circles are misaligned, with some floating in empty space or placed on the wrong end of the fish. Reposition the markers to correctly target the head, body, and dorsal eye-spots. |
| Common goby | _Pomatoschistus microps_ | fish | 8 | 1 | 3 | 65 | The circles are misaligned. Circle 2 needs to be moved to the actual pelvic fin area under the body, circle 3 should be shifted slightly back to cover the eyes and forehead, and circle 1 should encompass more of the body. |
| Conger eel | _Conger conger_ | fish | 4 | 1 | 3 | 75 | The overall photo is clear and shows the eel well, but circle 2 needs to be moved forward to where the dorsal fin actually begins near the pectoral fin. |
| Cuckoo wrasse | _Labrus mixtus_ | fish | 8 | 1 | 2 | 85 | The photo is excellent and clearly shows the male coloration. Circle 2 should be shifted slightly down and back to center directly on the bright orange flank. |
| European sea bass | _Dicentrarchus labrax_ | fish | 9 | 1 | 6 | 45 | The circles are completely misaligned, with several floating in the sky or placed on the wrong parts of the fish. All markers need to be repositioned to their correct anatomical features. |
| Fifteen-spined stickleback | _Spinachia spinachia_ | fish | 8 | 1 | 3 | 65 | The photo is a good lateral shot of the species, but the circles are poorly placed. Circle 2 needs to be moved forward to cover the snout, and Circle 3 needs to be moved up to the dorsal ridge where the tiny spines are located. |
| Lesser-spotted catshark | _Scyliorhinus canicula_ | fish | 7 | 1 | 2 | 85 | The photo is excellent, but the circles need to be resized and moved. Shrink circle 1 to focus tightly on the spotted skin, and shift circle 2 further down the tail to clearly encompass both dorsal fins. |
| Pollack | _Pollachius pollachius_ | fish | 8 | 1 | 3 | 65 | The photo shows a clear profile of a pollack, but the circles are badly misaligned. Move circle 1 forward to highlight the curve of the lateral line, move circle 2 to the tip of the snout and lower jaw, and move circle 3 to the smooth chin. |
| Poor cod | _Trisopterus minutus_ | fish | 4 | 1 | 3 | 75 | The photo is of good quality, but circle 1 is misaligned and sits entirely in the dark space below the fish's chin. Reposition circle 1 upward to target the actual chin barbel. |
| Rock goby | _Gobius paganellus_ | fish | 9 | 1 | 6 | 45 | Several circles are misaligned or floating in the background. Reposition and resize the circles to accurately target the fish's features, and remove duplicate markers for the dorsal fin band. |
| Sand goby | _Pomatoschistus minutus_ | fish | 8 | 2 | 3 | 45 | The circles are poorly placed and far too large, overlapping each other and missing the specific anatomical features. They need to be resized and moved to the correct locations on the fish. |
| Shanny | _Lipophrys pholis_ | fish | 5 | 1 | 3 | 75 | Move circle 2 forward to cover the eye and thick lips, and shrink circle 3 to focus directly on the mottled skin of the body flank rather than the pectoral fin. |
| Thick-lipped mullet | _Chelon labrosus_ | fish | 6 | 1 | 3 | 75 | The circles are misaligned, with circle 1 placed completely off the fish on the background. Reposition circle 1 onto the thick upper lip, use the large central circle for the striped flanks, and adjust circle 3 to show the separation between the two dorsal fins. |
| Common Limpet | _Patella vulgata_ | gastropod | 8 | 2 | 2 | 85 | The photo is excellent and shows the features clearly, but the circles need repositioning. Circle 1 should encompass the whole shell or be centered on it, and Circle 2 should be moved to the edge of the shell where it meets the bare rock substrate. |
| Barrel Jellyfish | _Rhizostoma octopus_ | jellyfish | 4 | 1 | 2 | 90 | The photo is excellent and very clear, but both circles are shifted too far outward into the open water. Move circle 1 leftward to center on the solid dome, and move circle 2 rightward to cover the thick frilly mouth-arms. |
| Compass Jellyfish | _Chrysaora hysoscella_ | jellyfish | 8 | 2 | 3 | 85 | The photo is excellent, but circle 2 needs to be centered directly on the dark central ring, and circle 3 should be moved higher up to capture the thicker, more visible tentacles and mouth-arms just below the bell. |
| Lion's Mane Jellyfish | _Cyanea capillata_ | jellyfish | 9 | 1 | 4 | 45 | The current circles are extremely large, overlapping, and mostly misaligned, with one circle completely off the animal. They need to be resized and repositioned to accurately target the bell and the tentacles of the jellyfish. |
| Atlantic Bobtail | _Sepiola atlantica_ | squid | 8 | 1 | 2 | 85 | Circle 1 needs to be moved to the actual ear-like fin on the side of the mantle, while Circle 2 is well-placed on the iridescent body. |
| Curled Octopus | _Eledone cirrhosa_ | squid | 8 | 2 | 1 | 65 | The circle is off-center and misses the main body of the octopus. Reposition the circle to encompass the entire octopus to clearly show the body and arms. |
| Veined Squid | _Loligo forbesii_ | squid | 4 | 1 | 2 | 85 | The photo is excellent and very clear, but the circles need to be repositioned. Circle 1 should be widened to show the overall torpedo body shape, and Circle 2 should be moved further back toward the tail to properly highlight the long rear fins. |
| Common Starfish | _Asterias rubens_ | starfish | 8 | 1 | 2 | 85 | The photo is excellent and clearly shows the starfish features, but the circles are poorly sized and positioned. Circle 1 should be resized to neatly frame the entire starfish, and Circle 2 should be shrunk and centered directly over the pale spine line of a single arm. |
| Cushion Star | _Asterina gibbosa_ | starfish | 8 | 2 | 2 | 85 | The photo is clear and shows the cushion star well, but the concentric circles are poorly aligned. Circle 1 should be adjusted to point directly to one of the short arms, and Circle 2 should be resized to encompass the entire pentagonal body outline. |

## OK - KEEP AS-IS (8)

| Species | Sci name | Class | Photos | Curated | Marks | Clarity | Recommendation / fix |
|---|---|---|---|---|---|---|---|
| Hermit Crab | _Pagurus bernhardus_ | crab | 8 | 1 | 2 | 85 | The photo is clear and sharp, and both circles are accurately placed to show the borrowed shell and the emerging legs. |
| Shore Crab | _Carcinus maenas_ | crab | 8 | 2 | 2 | 80 | The photo is clear and the circles are well-placed to show the diagnostic teeth on the carapace and the pointed walking legs. |
| Painted Top Shell | _Calliostoma zizyphinum_ | gastropod | 8 | 1 | 2 | 85 | The photo is excellent and the circles are accurately placed to show the straight-sided cone shape and the pointed apex. |
| Mauve Stinger | _Pelagia noctiluca_ | jellyfish | 8 | 1 | 3 | 90 | The photo is exceptionally clear and all three diagnostic features are perfectly aligned and easy to identify. No changes are needed. |
| Moon Jellyfish | _Aurelia aurita_ | jellyfish | 8 | 1 | 3 | 85 | The photo is exceptionally clear with a stark black background, and all three diagnostic features are perfectly aligned and highly visible. |
| Common Octopus | _Octopus vulgaris_ | squid | 8 | 2 | 1 | 85 | The annotation is well-placed on the octopus's mantle, clearly demonstrating the bulbous shape and warty skin texture. |
| European Squid | _Loligo vulgaris_ | squid | 8 | 2 | 2 | 85 | The photo is an excellent, clear lateral shot of the squid with both diagnostic features perfectly highlighted by the circles. |
| Common Brittlestar | _Ophiothrix fragilis_ | starfish | 8 | 2 | 2 | 65 | The annotations are correctly placed on the key features of the brittlestar. The image is somewhat busy but clearly shows the diagnostic spiny arms and central disc. |

