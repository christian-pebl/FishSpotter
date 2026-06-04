import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
type C={n:number;v:string;x?:number;y?:number;r?:number};
const data:Record<string,C[]>=JSON.parse(readFileSync("implementation/2026-06-04/mark-corrections-2.json","utf8"));
(async()=>{
  let upd=0,del=0;
  for(const [sci,corrs] of Object.entries(data)){
    const marks=await prisma.diagnosticMark.findMany({where:{scientificName:sci},orderBy:{order:"asc"}});
    const drops:string[]=[];
    for(const c of corrs){
      const m=marks[c.n-1];
      if(!m){console.log(`  ${sci} n=${c.n} MISSING`);continue;}
      if(c.v==="drop"){drops.push(m.id);console.log(`  ${sci} #${c.n} ${m.label}: DROP`);continue;}
      const nx=clamp(c.x!,0,1),ny=clamp(c.y!,0,1),nr=clamp(c.r!,0.01,0.5);
      console.log(`  ${sci} #${c.n} ${m.label}: -> (${nx},${ny},r${nr})${c.v==="good"?" [good]":""}`);
      if(APPLY){await prisma.diagnosticMark.update({where:{id:m.id},data:{overlayX:nx,overlayY:ny,overlayRadius:nr}});upd++;}
    }
    if(APPLY && drops.length){
      await prisma.diagnosticMark.deleteMany({where:{id:{in:drops}}});del+=drops.length;
      // re-sequence order 0..N-1
      const left=await prisma.diagnosticMark.findMany({where:{scientificName:sci},orderBy:{order:"asc"}});
      await prisma.$transaction(left.map((m,i)=>prisma.diagnosticMark.update({where:{id:m.id},data:{order:i}})));
    }
  }
  console.log(`\n${APPLY?`APPLIED ${upd} updates, ${del} deletes`:"DRY-RUN"}`);
  await prisma.$disconnect();
})();
