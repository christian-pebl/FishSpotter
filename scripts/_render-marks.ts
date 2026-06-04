/** Render current curated-lead marks for the 15 gap species to PNGs + manifest. */
import { PrismaClient } from "@prisma/client";
import { loadImage, buildOverlaySvg, type MarkRow } from "./lib/mark-overlay";
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";

const prisma = new PrismaClient();
const OUT = "implementation/2026-06-04/mark-renders";
const SPECIES: [string, string][] = [
  ["Scomber scombrus","Atlantic mackerel"],["Sprattus sprattus","Sprat"],
  ["Pollachius virens","Saithe"],["Callionymus maculatus","Spotted dragonet"],
  ["Atherina presbyter","Sand smelt"],["Limanda limanda","Dab"],
  ["Gadus morhua","Atlantic cod"],["Labrus bergylta","Ballan wrasse"],
  ["Symphodus melops","Corkwing wrasse"],["Ctenolabrus rupestris","Goldsinny wrasse"],
  ["Gobiusculus flavescens","Two-spotted goby"],["Pleuronectes platessa","Plaice"],
  ["Platichthys flesus","Flounder"],["Mullus surmuletus","Red mullet"],
  ["Taurulus bubalis","Long-spined sea scorpion"],
];
const slug = (s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,"-");

(async () => {
  mkdirSync(OUT, { recursive: true });
  const manifest:any[] = [];
  await Promise.all(SPECIES.map(async ([sci,common]) => {
    const lead = await prisma.speciesImage.findFirst({
      where:{scientificName:sci,curated:true}, orderBy:[{ordering:"asc"},{createdAt:"asc"}],
      select:{id:true,url:true,width:true,height:true},
    });
    if(!lead){ manifest.push({sci,common,error:"no curated lead"}); return; }
    const marks = await prisma.diagnosticMark.findMany({
      where:{scientificName:sci}, orderBy:{order:"asc"},
      select:{id:true,order:true,label:true,description:true,overlayX:true,overlayY:true,overlayRadius:true},
    });
    const mr:MarkRow[] = marks.map(m=>({label:m.label,description:m.description,overlayX:m.overlayX,overlayY:m.overlayY,overlayRadius:m.overlayRadius}));
    const {buf} = await loadImage(lead.url);
    const sl = slug(common);
    // Bake EXIF rotation into pixels so SVG dims match the raster exactly.
    const flat = await sharp(buf).rotate().png().toBuffer();
    const fmeta = await sharp(flat).metadata();
    const W = fmeta.width ?? 1000, H = fmeta.height ?? 1000;
    await sharp(flat).resize(900,null,{withoutEnlargement:true}).png().toFile(`${OUT}/${sl}-bare.png`);
    const svg = buildOverlaySvg(W,H,mr);
    const marked = await sharp(flat).composite([{input:Buffer.from(svg),top:0,left:0}]).png().toBuffer();
    await sharp(marked).resize(900,null,{withoutEnlargement:true}).png().toFile(`${OUT}/${sl}-marked.png`);
    manifest.push({sci,common,slug:sl,leadUrl:lead.url,width:W,height:H,
      marks:marks.map((m,i)=>({n:i+1,id:m.id,label:m.label,description:m.description,x:m.overlayX,y:m.overlayY,r:m.overlayRadius}))});
    console.log(`rendered ${common} (${marks.length} marks, ${W}x${H})`);
  }));
  writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest,null,2));
  console.log(`\nmanifest -> ${OUT}/manifest.json`);
  await prisma.$disconnect();
})();
