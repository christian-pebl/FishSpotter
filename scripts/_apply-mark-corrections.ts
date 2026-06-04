import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
type C={n:number;x:number;y:number;r:number};
const data:Record<string,C[]>=JSON.parse(readFileSync("implementation/2026-06-04/mark-corrections.json","utf8"));
(async()=>{
  let upd=0;
  for(const [sci,corrs] of Object.entries(data)){
    const marks=await prisma.diagnosticMark.findMany({where:{scientificName:sci},orderBy:{order:"asc"}});
    for(const c of corrs){
      const m=marks[c.n-1];
      if(!m){console.log(`  ${sci} n=${c.n} MISSING`);continue;}
      const nx=clamp(c.x,0,1),ny=clamp(c.y,0,1),nr=clamp(c.r,0.01,0.5);
      console.log(`  ${sci} #${c.n} ${m.label}: (${m.overlayX.toFixed(3)},${m.overlayY.toFixed(3)},r${m.overlayRadius.toFixed(3)}) -> (${nx},${ny},r${nr})`);
      if(APPLY){await prisma.diagnosticMark.update({where:{id:m.id},data:{overlayX:nx,overlayY:ny,overlayRadius:nr}});upd++;}
    }
  }
  console.log(`\n${APPLY?`APPLIED ${upd} updates`:"DRY-RUN (pass --apply to write)"}`);
  await prisma.$disconnect();
})();
