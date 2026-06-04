import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const FIX:Record<string,{n:number;x:number;y:number;r:number}[]>={
  // Butterfish: head is on the RIGHT; re-place all 3
  "Pholis gunnellus":[{n:1,x:0.18,y:0.27,r:0.05},{n:2,x:0.34,y:0.42,r:0.22},{n:3,x:0.63,y:0.40,r:0.08}],
  // Sand goby: nudge both rings right onto the body (head right ~0.82)
  "Pomatoschistus minutus":[{n:1,x:0.62,y:0.55,r:0.15},{n:2,x:0.62,y:0.45,r:0.07}],
};
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
(async()=>{
  for(const [sci,fixes] of Object.entries(FIX)){
    const marks=await prisma.diagnosticMark.findMany({where:{scientificName:sci},orderBy:{order:"asc"}});
    for(const f of fixes){
      const m=marks[f.n-1]; if(!m){console.log(`${sci} n=${f.n} MISSING`);continue;}
      await prisma.diagnosticMark.update({where:{id:m.id},data:{overlayX:clamp(f.x,0,1),overlayY:clamp(f.y,0,1),overlayRadius:clamp(f.r,0.01,0.5)}});
      console.log(`${sci} #${f.n} ${m.label} -> (${f.x},${f.y},r${f.r})`);
    }
  }
  await prisma.$disconnect();
})();
