import speciesTraits from "../src/data/species-traits.json";
import { buildStableSystemBlock, buildDynamicSystemBlock } from "../src/lib/idguide/prompt";

const stable = buildStableSystemBlock(speciesTraits as any);
const dynamic = buildDynamicSystemBlock({
  site: "Skomer SC1",
  deployment: "SC1-2024-06",
  lat: 51.738,
  lon: -5.297,
  depthM: 12,
  month: 6,
  monthName: "June",
  topSpecies: [
    { scientificName: "Pollachius pollachius", probability: 0.42 },
    { scientificName: "Labrus mixtus", probability: 0.18 },
    { scientificName: "Ctenolabrus rupestris", probability: 0.12 },
  ],
  recentNearby: ["Pollack", "Cuckoo wrasse"],
});

const approxTokens = (s: string) => Math.ceil(s.length / 4);
console.log("Stable block:  " + stable.length + " chars, ~" + approxTokens(stable) + " tokens");
console.log("Dynamic block: " + dynamic.length + " chars, ~" + approxTokens(dynamic) + " tokens");
console.log("Stable clears Sonnet 1024 cache threshold: " + (approxTokens(stable) >= 1024));
