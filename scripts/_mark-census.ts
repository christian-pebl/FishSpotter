import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const FIXED = new Set(["Scomber scombrus","Sprattus sprattus","Pollachius virens","Callionymus maculatus","Atherina presbyter","Limanda limanda","Gadus morhua","Labrus bergylta","Symphodus melops","Ctenolabrus rupestris","Gobiusculus flavescens","Pleuronectes platessa","Platichthys flesus","Mullus surmuletus","Taurulus bubalis"]);
(async()=>{
  const g = await prisma.diagnosticMark.groupBy({by:["scientificName"],_count:true});
  const rows:any[]=[];
  for(const x of g){
    const marks=await prisma.diagnosticMark.findMany({where:{scientificName:x.scientificName},orderBy:{order:"asc"},select:{label:true}});
    const labels=marks.map(m=>m.label.trim().toLowerCase());
    const dups=labels.filter((l,i)=>labels.indexOf(l)!==i);
    const curated=await prisma.speciesImage.count({where:{scientificName:x.scientificName,curated:true}});
    rows.push({sci:x.scientificName,n:x._count,curated,dups:[...new Set(dups)],fixed:FIXED.has(x.scientificName)});
  }
  rows.sort((a,b)=> (a.fixed?1:0)-(b.fixed?1:0) || b.n-a.n);
  console.log("FIXED? | marks | curated | dups | species");
  for(const r of rows) console.log(`${r.fixed?"  ✓  ":"  •  "} | ${String(r.n).padStart(2)} | ${r.curated} | ${r.dups.join(",")||"-"} | ${r.sci}`);
  console.log(`\nTotal marked species: ${rows.length}; not-yet-re-QA'd this session: ${rows.filter(r=>!r.fixed).length}`);
  await prisma.$disconnect();
})();
