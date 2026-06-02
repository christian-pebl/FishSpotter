import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// QA coordinate fixes (2 Jun 2026): rings that the render-back QA pass found
// sitting in open background rather than on the animal/feature. Coords are
// normalised 0..1 (x rightward, y downward), radius is fraction of min(w,h).
// Keyed by (scientificName, order). Idempotent: re-running just re-sets the
// same values. Supersedes the initial eyeballed drafts in the seed scripts
// for these 11 species; re-seeding is idempotent so it never clobbers these.
const FIXES: { sci: string; order: number; x: number; y: number; r: number }[] = [
  // Conger eel: head is far-left; dorsal ring floated above body, head ring sat on the tail
  { sci: "Conger conger", order: 1, x: 0.42, y: 0.40, r: 0.12 },
  { sci: "Conger conger", order: 2, x: 0.16, y: 0.40, r: 0.10 },
  // Cuttlefish: body/fin rings were off in the sand left of the animal
  { sci: "Sepia officinalis", order: 1, x: 0.62, y: 0.62, r: 0.12 },
  { sci: "Sepia officinalis", order: 2, x: 0.62, y: 0.50, r: 0.14 },
  // Horse mackerel: dorsal ring above body, eye ring in dark water; eye is lower-right
  { sci: "Trachurus trachurus", order: 0, x: 0.52, y: 0.55, r: 0.16 },
  { sci: "Trachurus trachurus", order: 1, x: 0.45, y: 0.42, r: 0.12 },
  { sci: "Trachurus trachurus", order: 2, x: 0.80, y: 0.55, r: 0.09 },
  // Corkwing: head is at the right; dark caudal-peduncle spot is at the tail base on the left (~0.24)
  { sci: "Symphodus melops", order: 1, x: 0.24, y: 0.50, r: 0.06 },
  // Curled octopus: both rings were lower-left in the reef; body is centre
  { sci: "Eledone cirrhosa", order: 0, x: 0.52, y: 0.55, r: 0.16 },
  { sci: "Eledone cirrhosa", order: 1, x: 0.48, y: 0.60, r: 0.10 },
  // Two-spotted goby: tail-base spot ring was in open water; head is left, tail base is at the right end
  { sci: "Gobiusculus flavescens", order: 1, x: 0.80, y: 0.54, r: 0.07 },
  // Cuckoo wrasse: head ring + "females differ" ring were off in the reef
  { sci: "Labrus mixtus", order: 0, x: 0.35, y: 0.50, r: 0.12 },
  { sci: "Labrus mixtus", order: 2, x: 0.50, y: 0.52, r: 0.10 },
  // Shore crab: walking-legs ring was in the sand right of the crab
  { sci: "Carcinus maenas", order: 1, x: 0.35, y: 0.62, r: 0.12 },
  // Dragonet: tall-dorsal ring was in open sand upper-right; dorsal is on the back
  { sci: "Callionymus lyra", order: 2, x: 0.45, y: 0.45, r: 0.09 },
  // Common squid: tail-fin ring was far left in weed; body is centre-right
  { sci: "Loligo vulgaris", order: 0, x: 0.52, y: 0.56, r: 0.12 },
  { sci: "Loligo vulgaris", order: 1, x: 0.66, y: 0.54, r: 0.10 },
  // Rock goby: dorsal ring sat above the fish; caudal fan is at the right, so head/blunt-snout is at the left
  { sci: "Gobius paganellus", order: 0, x: 0.44, y: 0.40, r: 0.08 },
  { sci: "Gobius paganellus", order: 2, x: 0.31, y: 0.51, r: 0.08 },
  // Sea bass: NEW curated photo (144311743, georgedros) — single fish held head-LEFT, tail right
  { sci: "Dicentrarchus labrax", order: 0, x: 0.48, y: 0.38, r: 0.12 },
  { sci: "Dicentrarchus labrax", order: 1, x: 0.45, y: 0.50, r: 0.15 },
  { sci: "Dicentrarchus labrax", order: 2, x: 0.27, y: 0.52, r: 0.08 },
  // Thick-lipped mullet: NEW curated photo (158973980, Luca Boscain) — single fish head-right over sand
  { sci: "Chelon labrosus", order: 0, x: 0.90, y: 0.55, r: 0.06 },
  { sci: "Chelon labrosus", order: 1, x: 0.50, y: 0.52, r: 0.16 },
  { sci: "Chelon labrosus", order: 2, x: 0.62, y: 0.38, r: 0.11 },
  // 15-spined stickleback: pre-dorsal-spine ring floated above the elongate body; body ring slightly high
  { sci: "Spinachia spinachia", order: 0, x: 0.48, y: 0.48, r: 0.18 },
  { sci: "Spinachia spinachia", order: 2, x: 0.45, y: 0.42, r: 0.10 },
  // Long-spined sea scorpion: head/big-spiny-head is at the LEFT (eye left, tail right); body mark mid-right
  { sci: "Taurulus bubalis", order: 0, x: 0.28, y: 0.50, r: 0.07 },
  { sci: "Taurulus bubalis", order: 1, x: 0.22, y: 0.47, r: 0.13 },
  { sci: "Taurulus bubalis", order: 2, x: 0.50, y: 0.52, r: 0.12 },
  // Poor cod: head is at the right; chin-barbel + eye rings were on mid-body
  { sci: "Trisopterus minutus", order: 0, x: 0.80, y: 0.58, r: 0.05 },
  { sci: "Trisopterus minutus", order: 1, x: 0.80, y: 0.45, r: 0.06 },
  { sci: "Trisopterus minutus", order: 2, x: 0.50, y: 0.50, r: 0.12 },
];

(async () => {
  let n = 0;
  for (const f of FIXES) {
    const res = await prisma.diagnosticMark.updateMany({
      where: { scientificName: f.sci, order: f.order },
      data: { overlayX: f.x, overlayY: f.y, overlayRadius: f.r },
    });
    if (res.count === 0) console.warn("NO MATCH", f.sci, "order", f.order);
    else n += res.count;
  }
  console.log("updated", n, "marks across", new Set(FIXES.map((f) => f.sci)).size, "species");
  await prisma.$disconnect();
})();
